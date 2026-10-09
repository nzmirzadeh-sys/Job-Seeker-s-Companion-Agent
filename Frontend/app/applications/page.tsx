"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RetroButton, RetroWindow } from "@/components/retro";
import {
  createApplication,
  decideApplicationSuggestion,
  deleteApplication,
  getApplication,
  generateApplicationSuggestions,
  getApplicationSuggestions,
  getToken,
  listApplications,
  updateApplication,
  type ApplicationStatus,
  type ApplicationSuggestion,
  type JobApplication,
} from "@/lib/api";

const statuses: ApplicationStatus[] = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "NO_RESPONSE",
];

const statusLabels: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  NO_RESPONSE: "No response",
};

function localDateValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

type ApplicationDraft = {
  status: ApplicationStatus;
  outcome_reason: string;
};

export default function ApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [applicationDetails, setApplicationDetails] = useState<
    Record<number, JobApplication>
  >({});
  const [expandedApplicationId, setExpandedApplicationId] = useState<number | null>(
    null
  );
  const [suggestions, setSuggestions] = useState<ApplicationSuggestion[]>([]);
  const [drafts, setDrafts] = useState<Record<number, ApplicationDraft>>({});
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [appliedOn, setAppliedOn] = useState(localDateValue);
  const [requiredSkills, setRequiredSkills] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [insightMessage, setInsightMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function refreshData() {
    setError("");
    try {
      const applicationPage = await listApplications();
      setApplications(applicationPage.results);
      setDrafts(
        Object.fromEntries(
          applicationPage.results.map((application) => [
            application.id,
            {
              status: application.status,
              outcome_reason: application.outcome_reason,
            },
          ])
        )
      );
      const suggestionPage = await getApplicationSuggestions();
      setSuggestions(suggestionPage.results);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    void refreshData();
  }, [router]);

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!company.trim() || !jobTitle.trim()) {
      setError("Company and job title are required.");
      return;
    }
    const requirements = requiredSkills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);
    if (requirements.length > 30 || requirements.some((skill) => skill.length > 120)) {
      setError("Enter no more than 30 requirements, with at most 120 characters each.");
      return;
    }
    setSaving(true);
    try {
      await createApplication({
        company: company.trim(),
        job_title: jobTitle.trim(),
        applied_on: appliedOn,
        required_skills: requirements,
        notes,
      });
      setCompany("");
      setJobTitle("");
      setRequiredSkills("");
      setNotes("");
      await refreshData();
      setSuccess("Application recorded.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save application.");
    } finally {
      setSaving(false);
    }
  }

  async function saveApplication(application: JobApplication) {
    const draft = drafts[application.id];
    if (!draft) return;
    setError("");
    setSuccess("");
    setBusyAction(`save-${application.id}`);
    try {
      await updateApplication(application.id, draft);
      await refreshData();
      setSuccess("Application updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update application.");
    } finally {
      setBusyAction(null);
    }
  }

  async function removeApplication(id: number) {
    setError("");
    setSuccess("");
    setBusyAction(`delete-${id}`);
    try {
      await deleteApplication(id);
      await refreshData();
      setApplicationDetails((current) => {
        const updated = { ...current };
        delete updated[id];
        return updated;
      });
      setSuccess("Application deleted.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete application.");
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleApplicationDetails(id: number) {
    if (expandedApplicationId === id) {
      setExpandedApplicationId(null);
      return;
    }
    setError("");
    setExpandedApplicationId(id);
    if (applicationDetails[id]) return;
    setBusyAction(`details-${id}`);
    try {
      const details = await getApplication(id);
      setApplicationDetails((current) => ({ ...current, [id]: details }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load application details.");
    } finally {
      setBusyAction(null);
    }
  }

  async function refreshSuggestions() {
    setError("");
    setSuccess("");
    setBusyAction("suggestions");
    try {
      const generated = await generateApplicationSuggestions();
      setInsightMessage(generated.detail);
      const suggestionPage = await getApplicationSuggestions();
      setSuggestions(suggestionPage.results);
      setSuccess(
        generated.insufficient_data
          ? "Not enough recorded evidence for a suggestion yet."
          : "Suggestions refreshed from your application history."
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate suggestions.");
    } finally {
      setBusyAction(null);
    }
  }

  async function decideSuggestion(
    suggestion: ApplicationSuggestion,
    decision: "accepted" | "rejected"
  ) {
    setError("");
    setSuccess("");
    setBusyAction(`decision-${suggestion.id}`);
    try {
      await decideApplicationSuggestion(suggestion.id, decision);
      const suggestionPage = await getApplicationSuggestions();
      setSuggestions(suggestionPage.results);
      setSuccess(`Suggestion ${decision}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your decision.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] p-4">
      <div className="mx-auto max-w-4xl space-y-5">
        <RetroWindow title="Job applications" className="w-full">
          <div className="space-y-5 p-2">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                  Application tracker
                </h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  Record outcomes and learn from recurring job requirements.
                </p>
              </div>
              <Link href="/" className="text-sm underline">
                Home
              </Link>
            </header>

            {error && (
              <p role="alert" className="rounded border border-red-500 p-3 text-red-700">
                {error}
              </p>
            )}
            {success && (
              <p role="status" className="rounded border border-green-600 p-3 text-green-800">
                {success}
              </p>
            )}

            <section className="rounded border border-[var(--border-color)] p-4">
              <h2 className="mb-3 text-lg font-semibold">Add an application</h2>
              <form onSubmit={submitApplication} className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  Company
                  <input
                    required
                    maxLength={200}
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    className="rounded border bg-transparent p-2"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Job title
                  <input
                    required
                    maxLength={200}
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                    className="rounded border bg-transparent p-2"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Application date
                  <input
                    required
                    type="date"
                    max={localDateValue()}
                    value={appliedOn}
                    onChange={(event) => setAppliedOn(event.target.value)}
                    className="rounded border bg-transparent p-2"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Listed requirements (comma separated)
                  <input
                    value={requiredSkills}
                    onChange={(event) => setRequiredSkills(event.target.value)}
                    placeholder="SQL, Excel"
                    className="rounded border bg-transparent p-2"
                  />
                </label>
                <label className="grid gap-1 text-sm sm:col-span-2">
                  Notes
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    maxLength={5000}
                    rows={2}
                    className="rounded border bg-transparent p-2"
                  />
                </label>
                <div className="sm:col-span-2">
                  <RetroButton type="submit" variant="primary" disabled={saving}>
                    {saving ? "Saving…" : "Record application"}
                  </RetroButton>
                </div>
              </form>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Your applications</h2>
              {loading ? (
                <p>Loading…</p>
              ) : applications.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  No applications recorded yet.
                </p>
              ) : (
                applications.map((application) => {
                  const draft = drafts[application.id] ?? {
                    status: application.status,
                    outcome_reason: application.outcome_reason,
                  };
                  return (
                    <article
                      key={application.id}
                      className="space-y-3 rounded border border-[var(--border-color)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{application.job_title}</h3>
                          <p className="text-sm text-[var(--text-secondary)]">
                            {application.company} · {application.applied_on}
                          </p>
                          {application.required_skills.length > 0 && (
                            <p className="mt-1 text-sm">
                              Listed requirements: {application.required_skills.join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => void toggleApplicationDetails(application.id)}
                            disabled={busyAction === `details-${application.id}`}
                            className="text-sm underline disabled:opacity-50"
                          >
                            {expandedApplicationId === application.id
                              ? "Hide details"
                              : busyAction === `details-${application.id}`
                                ? "Loading details…"
                                : "View details"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeApplication(application.id)}
                            disabled={busyAction === `delete-${application.id}`}
                            className="text-sm text-red-700 underline disabled:opacity-50"
                          >
                            {busyAction === `delete-${application.id}` ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </div>
                      {expandedApplicationId === application.id &&
                        applicationDetails[application.id] && (
                          <dl className="grid gap-2 rounded bg-[var(--bg-secondary)] p-3 text-sm">
                            <div>
                              <dt className="font-semibold">Notes</dt>
                              <dd>{applicationDetails[application.id].notes || "None"}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold">Outcome details</dt>
                              <dd>
                                {applicationDetails[application.id].outcome_reason || "None"}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-semibold">Linked job posting</dt>
                              <dd>
                                {applicationDetails[application.id].job_posting ?? "None"}
                              </dd>
                            </div>
                          </dl>
                        )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm">
                          Status
                          <select
                            value={draft.status}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [application.id]: {
                                  ...draft,
                                  status: event.target.value as ApplicationStatus,
                                },
                              }))
                            }
                            className="rounded border bg-transparent p-2"
                          >
                            {statuses.map((value) => (
                              <option key={value} value={value}>
                                {statusLabels[value]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1 text-sm">
                          Optional outcome or feedback
                          <input
                            value={draft.outcome_reason}
                            maxLength={5000}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [application.id]: {
                                  ...draft,
                                  outcome_reason: event.target.value,
                                },
                              }))
                            }
                            className="rounded border bg-transparent p-2"
                          />
                        </label>
                      </div>
                      <RetroButton
                        type="button"
                        size="sm"
                        disabled={busyAction === `save-${application.id}`}
                        onClick={() => void saveApplication(application)}
                      >
                        {busyAction === `save-${application.id}` ? "Saving…" : "Save changes"}
                      </RetroButton>
                    </article>
                  );
                })
              )}
            </section>

            <section className="space-y-3 border-t border-[var(--border-color)] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Evidence-based suggestions</h2>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Suggestions require repeated outcomes and job requirements.
                  </p>
                </div>
                <RetroButton
                  type="button"
                  disabled={busyAction === "suggestions"}
                  onClick={() => void refreshSuggestions()}
                >
                  {busyAction === "suggestions" ? "Reviewing…" : "Review patterns"}
                </RetroButton>
              </div>
              {insightMessage && <p className="text-sm">{insightMessage}</p>}
              <p className="text-xs text-[var(--text-secondary)]">
                Accepting or rejecting records your choice only. Suggestions do not
                update Career Memory or change profile facts.
              </p>
              {suggestions.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  No suggestions yet. Review patterns after recording more outcomes.
                </p>
              ) : (
                suggestions.map((suggestion) => (
                  <article
                    key={suggestion.id}
                    className="space-y-2 rounded border border-[var(--border-color)] p-4"
                  >
                    <p>{suggestion.suggestion}</p>
                    <p className="text-sm">
                      Evidence ({suggestion.evidence.comparable_applications} comparable
                      applications, {suggestion.confidence} confidence):
                    </p>
                    <ul className="list-disc pl-5 text-sm">
                      {suggestion.evidence.supporting_observations.map((observation) => (
                        <li key={observation}>{observation}</li>
                      ))}
                    </ul>
                    <p className="text-xs">Decision: {suggestion.status}</p>
                    {suggestion.status === "pending" && (
                      <div className="flex gap-2">
                        <RetroButton
                          type="button"
                          size="sm"
                          variant="success"
                          disabled={busyAction === `decision-${suggestion.id}`}
                          onClick={() => void decideSuggestion(suggestion, "accepted")}
                        >
                          Accept
                        </RetroButton>
                        <RetroButton
                          type="button"
                          size="sm"
                          variant="danger"
                          disabled={busyAction === `decision-${suggestion.id}`}
                          onClick={() => void decideSuggestion(suggestion, "rejected")}
                        >
                          Reject
                        </RetroButton>
                      </div>
                    )}
                  </article>
                ))
              )}
            </section>
          </div>
        </RetroWindow>
      </div>
    </main>
  );
}
