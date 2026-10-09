"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import RetroWindow from "@/components/retro/RetroWindow";
import {
  analyzeJobForInterview,
  answerInterviewQuestion,
  getInterviewProgress,
  getInterviewReport,
  getInterviewSession,
  getInterviewSessions,
  getToken,
  startInterview,
  type InterviewFeedback,
  type InterviewHistoryItem,
  type InterviewProgressResponse,
  type InterviewSession,
  type InterviewType,
  type MatchRow,
} from "@/lib/api";
import { api, type PaginatedResponse } from "@/lib/api";

const interviewTypes: Array<{ value: InterviewType; label: string }> = [
  { value: "technical", label: "فنی" },
  { value: "behavioral", label: "رفتاری" },
  { value: "general", label: "عمومی شغلی" },
];

const typeLabel = (value: InterviewType) =>
  interviewTypes.find((item) => item.value === value)?.label ?? value;

export default function InterviewPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<MatchRow[]>([]);
  const [sessions, setSessions] = useState<InterviewHistoryItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [interviewType, setInterviewType] = useState<InterviewType>("technical");
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null);
  const [report, setReport] = useState<Awaited<
    ReturnType<typeof getInterviewReport>
  > | null>(null);
  const [progress, setProgress] = useState<InterviewProgressResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [latestFeedback, setLatestFeedback] = useState<InterviewFeedback | null>(null);
  const [showingFeedback, setShowingFeedback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const refreshHistory = useCallback(async () => {
    const [jobPage, historyPage] = await Promise.all([
      api<PaginatedResponse<MatchRow>>("/jobs/feed/?limit=50"),
      getInterviewSessions({ limit: 50 }),
    ]);
    setJobs(jobPage.results);
    setSessions(historyPage.results);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    void refreshHistory()
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "بارگذاری اطلاعات مصاحبه ناموفق بود.");
      })
      .finally(() => setLoading(false));
  }, [refreshHistory, router]);

  function clearSessionView() {
    setActiveSession(null);
    setReport(null);
    setProgress(null);
    setLatestFeedback(null);
    setShowingFeedback(false);
    setAnswer("");
    setError("");
    setStatusMessage("");
  }

  async function beginInterview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJobId) {
      setError("ابتدا یک آگهی شغلی انتخاب کن.");
      return;
    }
    const selectedJob = jobs.find(
      ({ job }) => String(job.id) === String(selectedJobId)
    )?.job;
    if (!selectedJob?.description || selectedJob.description.trim().length < 40) {
      setError(
        "برای این آگهی شرح شغل کافی ثبت نشده است. ابتدا شرح کامل آگهی را در بخش تحلیل شغل وارد و تحلیل کن."
      );
      return;
    }
    setBusy(true);
    setError("");
    setStatusMessage("");
    clearSessionView();
    try {
      const analysis = await analyzeJobForInterview(selectedJob.description);
      const started = await startInterview({
        job_id: selectedJobId,
        job_analysis: analysis.job_analysis.job,
        interview_type: interviewType,
        max_questions: 3,
      });
      const session = await getInterviewSession(started.session_id);
      setActiveSession(session);
      setProgress(await getInterviewProgress(session.interview_type));
      if (started.memory_unavailable) {
        setStatusMessage("حافظهٔ شغلی در دسترس نبود؛ تمرین فقط با اطلاعات آگهی ادامه می‌یابد.");
      } else {
        setStatusMessage(
          analysis.job_analysis.warnings.length
            ? `جلسه بر اساس تحلیل تأییدشدهٔ آگهی آغاز شد. هشدار تحلیل: ${analysis.job_analysis.warnings.join("؛ ")}`
            : "جلسه بر اساس نتیجهٔ تأییدشدهٔ تحلیل شغل آغاز شد."
        );
      }
      await refreshHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "شروع مصاحبه ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function openSession(sessionId: number) {
    setBusy(true);
    setError("");
    setStatusMessage("");
    clearSessionView();
    try {
      const session = await getInterviewSession(sessionId);
      setActiveSession(session);
      if (session.status === "done") {
        const savedReport = await getInterviewReport(sessionId);
        setReport(savedReport);
        setProgress(savedReport.report.progress);
      } else {
        setProgress(await getInterviewProgress(session.interview_type));
        const savedFeedback = session.feedback_history.at(-1) ?? null;
        setLatestFeedback(savedFeedback);
        setShowingFeedback(Boolean(savedFeedback));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "بارگذاری جلسه ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSession || !answer.trim()) {
      setError("پاسخ متنی را وارد کن.");
      return;
    }
    const questionNumber = activeSession.answers.length + 1;
    setBusy(true);
    setError("");
    setStatusMessage("");
    try {
      const result = await answerInterviewQuestion({
        session_id: activeSession.id,
        answer,
        expected_question_number: questionNumber,
      });
      const updatedSession = await getInterviewSession(activeSession.id);
      setActiveSession(updatedSession);
      setLatestFeedback(result.feedback);
      setShowingFeedback(true);
      setAnswer("");
      if (result.memory_unavailable) {
        setStatusMessage("پاسخ ارزیابی شد؛ حافظهٔ شغلی در دسترس نبود و تغییری در آن ایجاد نشد.");
      } else {
        setStatusMessage("پاسخ و ارزیابی آن در جلسه ذخیره شد.");
      }
      if (result.is_complete) {
        const savedReport = await getInterviewReport(activeSession.id);
        setReport(savedReport);
        setProgress(savedReport.report.progress);
      }
      await refreshHistory();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "ارسال پاسخ ناموفق بود. پاسخ در کادر نگه داشته شده است."
      );
    } finally {
      setBusy(false);
    }
  }

  async function openReport(sessionId: number) {
    setBusy(true);
    setError("");
    clearSessionView();
    try {
      const savedReport = await getInterviewReport(sessionId);
      setActiveSession(savedReport);
      setReport(savedReport);
      setProgress(savedReport.report.progress);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "دریافت گزارش ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function reloadProgress() {
    if (!activeSession) return;
    setBusy(true);
    setError("");
    try {
      setProgress(await getInterviewProgress(activeSession.interview_type));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "دریافت روند پیشرفت ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const currentQuestion =
    activeSession?.questions[activeSession.answers.length] ?? null;
  const latestCriterionScore = latestFeedback?.overall_score;
  const completedCount = activeSession?.answers.length ?? 0;
  const totalQuestionCount = activeSession?.max_questions ?? 3;

  return (
    <main dir="rtl" className="min-h-screen bg-[var(--bg-primary)] p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <RetroWindow title="شبیه‌ساز مصاحبهٔ متنی" className="w-full">
          <div className="space-y-6 p-2">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">تمرین مصاحبهٔ شغلی</h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  پرسش‌ها و ارزیابی‌ها فقط برای تمرین هستند و نتیجهٔ استخدام را پیش‌بینی نمی‌کنند.
                </p>
              </div>
              <Link href="/" className="text-sm underline">
                بازگشت به خانه
              </Link>
            </header>

            {error && (
              <p role="alert" className="rounded border border-red-500 p-3 text-red-700">
                {error}
              </p>
            )}
            {statusMessage && (
              <p role="status" className="rounded border border-green-600 p-3 text-green-800">
                {statusMessage}
              </p>
            )}

            {!activeSession && (
              <section className="space-y-3 rounded border p-4">
                <h2 className="text-lg font-semibold">شروع تمرین سه‌پرسشی</h2>
                {loading ? (
                  <p>در حال دریافت آگهی‌ها و سابقهٔ تمرین…</p>
                ) : jobs.length === 0 ? (
                  <p role="status">
                    آگهی قابل انتخابی وجود ندارد. ابتدا آگهی‌های فید شغلی را بارگذاری یا ذخیره کن.
                  </p>
                ) : (
                  <form onSubmit={beginInterview} className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      آگهی شغلی (نیازمند شرح کافی برای تحلیل)
                      <select
                        required
                        value={selectedJobId}
                        onChange={(event) => setSelectedJobId(event.target.value)}
                        className="rounded border bg-transparent p-2"
                      >
                        <option value="">انتخاب آگهی</option>
                        {jobs.map(({ job }) => (
                          <option key={job.id} value={job.id}>
                            {job.title} — {job.company}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      نوع مصاحبه
                      <select
                        value={interviewType}
                        onChange={(event) =>
                          setInterviewType(event.target.value as InterviewType)
                        }
                        className="rounded border bg-transparent p-2"
                      >
                        {interviewTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-xs text-[var(--text-secondary)] sm:col-span-2">
                      شرح آگهی ابتدا با Job Analyzer موجود تحلیل می‌شود. حداکثر سه پرسش
                      از نتیجهٔ ساختاریافته و تأییدشدهٔ آن ساخته خواهد شد.
                    </p>
                    <Button type="submit" disabled={busy} className="sm:col-span-2">
                      {busy ? "در حال آماده‌سازی…" : "شروع مصاحبه"}
                    </Button>
                  </form>
                )}
              </section>
            )}

            {activeSession && !report && (
              <section className="space-y-4 rounded border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{activeSession.job_title}</h2>
                    <p className="text-sm">
                      نوع: {typeLabel(activeSession.interview_type)} · معیار:{" "}
                      {activeSession.rubric_version}
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={clearSessionView}>
                    بستن جلسه
                  </Button>
                </div>

                {activeSession.status === "in_progress" && currentQuestion ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>پرسش {Math.min(completedCount + 1, totalQuestionCount)} از {totalQuestionCount}</span>
                        <span>پاسخ‌داده‌شده: {completedCount}</span>
                      </div>
                      <Progress
                        value={(completedCount / totalQuestionCount) * 100}
                        aria-label="پیشرفت مصاحبه"
                      />
                    </div>
                    {showingFeedback && latestFeedback ? (
                      <FeedbackCard feedback={latestFeedback} />
                    ) : (
                      <>
                        <article className="space-y-2 rounded bg-[var(--bg-secondary)] p-4">
                          <p className="font-semibold">{currentQuestion.question}</p>
                          <p className="text-sm">مهارت/موضوع: {currentQuestion.competency}</p>
                          <p className="text-sm">{currentQuestion.purpose || currentQuestion.rationale}</p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            معیارهای ارزیابی: {currentQuestion.assessment_criteria.join("، ")}
                          </p>
                        </article>
                        <form onSubmit={submitAnswer} className="space-y-3">
                          <label htmlFor="interview-answer" className="block text-sm font-medium">
                            پاسخ متنی تو
                          </label>
                          <textarea
                            id="interview-answer"
                            required
                            maxLength={10000}
                            rows={7}
                            value={answer}
                            onChange={(event) => setAnswer(event.target.value)}
                            placeholder="پاسخت را با جزئیات مرتبط و مثال واقعی بنویس…"
                            className="w-full rounded border bg-transparent p-3"
                          />
                          <p className="text-xs text-[var(--text-secondary)]">
                            {answer.length}/10,000 نویسه
                          </p>
                          <Button type="submit" disabled={busy || !answer.trim()}>
                            {busy ? "در حال ذخیره و ارزیابی…" : "ثبت پاسخ"}
                          </Button>
                        </form>
                      </>
                    )}
                    {showingFeedback && latestFeedback && (
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => setShowingFeedback(false)}
                      >
                        رفتن به پرسش بعدی ({Math.max(0, totalQuestionCount - completedCount)} پرسش باقی‌مانده)
                      </Button>
                    )}
                  </>
                ) : (
                  <p role="status">این جلسه فعال نیست.</p>
                )}
              </section>
            )}

            {report && activeSession && (
              <section className="space-y-4 rounded border p-4">
                <div>
                  <h2 className="text-xl font-semibold">گزارش جلسه: {activeSession.job_title}</h2>
                  <p className="text-sm">
                    {typeLabel(activeSession.interview_type)} · نسخهٔ روبریک{" "}
                    {activeSession.rubric_version} · تکمیل‌شده در{" "}
                    {activeSession.completed_at
                      ? new Date(activeSession.completed_at).toLocaleString()
                      : "—"}
                  </p>
                </div>
                {report.report.summary && (
                  <div className="space-y-2 rounded bg-[var(--bg-secondary)] p-4">
                    <h3 className="font-semibold">جمع‌بندی تمرین</h3>
                    <p>{report.report.summary.overall_feedback}</p>
                    <BulletList title="نقاط قوت ثبت‌شده" values={report.report.summary.strengths} />
                    <BulletList
                      title="موضوعات نیازمند شواهد بیشتر"
                      values={report.report.summary.areas_needing_evidence}
                    />
                    <BulletList title="گام‌های بعدی" values={report.report.summary.next_steps} />
                  </div>
                )}
                <div className="space-y-4">
                  {report.report.questions_and_evaluations.map((item, index) => (
                    <article key={`${index}-${item.question.question}`} className="space-y-3 rounded border p-3">
                      <h3 className="font-semibold">
                        پرسش {index + 1}: {item.question.question}
                      </h3>
                      <p className="text-sm">موضوع: {item.question.competency}</p>
                      {item.answer && (
                        <div>
                          <h4 className="text-sm font-semibold">پاسخ ثبت‌شده</h4>
                          <p className="whitespace-pre-wrap text-sm">{item.answer}</p>
                        </div>
                      )}
                      {item.evaluation && <FeedbackCard feedback={item.evaluation} />}
                    </article>
                  ))}
                </div>
                <ProgressPanel progress={progress} onReload={reloadProgress} busy={busy} />
                <Button type="button" variant="outline" onClick={clearSessionView}>
                  بازگشت به فهرست و شروع تمرین
                </Button>
              </section>
            )}

            {!activeSession && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">جلسه‌های قبلی</h2>
                {loading ? (
                  <p>در حال بارگذاری…</p>
                ) : sessions.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">
                    سابقه‌ای برای نمایش وجود ندارد.
                  </p>
                ) : (
                  sessions.map((session) => (
                    <article key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
                      <div>
                        <h3 className="font-semibold">{session.job_title}</h3>
                        <p className="text-sm">
                          {typeLabel(session.interview_type)} · {session.answered_count}/
                          {session.question_count} پاسخ · {session.status}
                        </p>
                        <p className="text-xs">{new Date(session.created_at).toLocaleString()}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          session.status === "done"
                            ? void openReport(session.id)
                            : void openSession(session.id)
                        }
                      >
                        {session.status === "done" ? "مشاهدهٔ گزارش" : "ادامهٔ جلسه"}
                      </Button>
                    </article>
                  ))
                )}
              </section>
            )}

            {activeSession && !report && progress && (
              <ProgressPanel progress={progress} onReload={reloadProgress} busy={busy} />
            )}

            {latestFeedback && !report && activeSession?.status === "in_progress" && (
              <p className="text-xs text-[var(--text-secondary)]">
                امتیاز این پاسخ: {latestCriterionScore ?? "شواهد ناکافی"} از ۵ — این امتیاز فقط تمرینی است.
              </p>
            )}
          </div>
        </RetroWindow>
      </div>
    </main>
  );
}

function BulletList({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="list-disc pr-5 text-sm">
        {values.map((value, index) => <li key={`${index}-${value}`}>{value}</li>)}
      </ul>
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback: InterviewFeedback }) {
  return (
    <section className="space-y-3 rounded bg-[var(--bg-secondary)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">بازخورد ارزیابی</h3>
        <span className="text-sm">
          {feedback.insufficient_evidence || feedback.overall_score === null
            ? "شواهد ناکافی برای امتیاز کلی"
            : `امتیاز تمرینی ${feedback.overall_score} از ۵`}
        </span>
      </div>
      {feedback.competency && (
        <p className="text-sm">شایستگی بررسی‌شده: {feedback.competency}</p>
      )}
      <p className="text-sm">{feedback.feedback}</p>
      {feedback.criteria.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">ارزیابی معیارها</h4>
          {feedback.criteria.map((criterion) => (
            <article key={criterion.criterion} className="rounded border p-2 text-sm">
              <p className="font-medium">
                {criterion.criterion}: {criterion.score ?? "بدون امتیاز"}
              </p>
              <p>{criterion.explanation}</p>
              {criterion.evidence.length > 0 && (
                <p>شاهد از پاسخ: «{criterion.evidence.join("»؛ «")}»</p>
              )}
            </article>
          ))}
        </div>
      )}
      <BulletList title="نقاط قوت" values={feedback.strengths} />
      <BulletList title="موارد قابل بهبود" values={feedback.weaknesses} />
      <BulletList title="پیشنهادهای تمرین" values={feedback.improvement_suggestions} />
      <p className="text-sm">{feedback.better_answer_hint}</p>
      {feedback.follow_up_question && (
        <p className="text-sm">پرسش تکمیلی پیشنهادی: {feedback.follow_up_question}</p>
      )}
    </section>
  );
}

function ProgressPanel({
  progress,
  onReload,
  busy,
}: {
  progress: InterviewProgressResponse | null;
  onReload: () => void;
  busy: boolean;
}) {
  if (!progress) return null;
  return (
    <section className="space-y-2 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">روند تمرین‌های قابل مقایسه</h3>
        <Button type="button" variant="outline" disabled={busy} onClick={onReload}>
          به‌روزرسانی
        </Button>
      </div>
      <p className="text-sm">{progress.detail}</p>
      {progress.incompatible_sessions_excluded > 0 && (
        <p className="text-sm">
          {progress.incompatible_sessions_excluded} جلسه با روبریک یا نوع متفاوت مقایسه نشد.
        </p>
      )}
      {progress.competencies.length === 0 ? (
        <p className="text-sm">هنوز امتیاز قابل مقایسه‌ای برای مهارت‌ها ثبت نشده است.</p>
      ) : (
        <ul className="space-y-2">
          {progress.competencies.map((item) => (
            <li key={item.competency} className="rounded border p-2 text-sm">
              <p className="font-medium">{item.competency}</p>
              <p>امتیازهای ثبت‌شده: {item.observations.map((point) => point.score).join("، ")}</p>
              {item.change !== null && (
                <p>تغییر مشاهده‌شده: {item.change > 0 ? "+" : ""}{item.change} (توصیفی، نه معناداری آماری)</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
