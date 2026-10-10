"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  getJobMatchDetail,
  getToken,
  sendJobFeedback,
  type JobMatchDetail,
  type MatchDecisionResult,
} from "@/lib/api";
import JobsSidebar from "@/components/jobs/JobsSidebar";
import MatchScoreBadge from "@/components/jobs/MatchScoreBadge";
import BreakdownBars from "@/components/jobs/BreakdownBars";
import ReasonsList from "@/components/jobs/ReasonsList";
import JobMetaChips from "@/components/jobs/JobMetaChips";
import SkillChips from "@/components/jobs/SkillChips";
import { jobsTheme } from "@/components/jobs/theme";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

const DECISION_LABELS: Record<string, string> = {
  strong_match: "تناسب قوی",
  good_match: "تناسب خوب",
  partial_match: "تناسب نسبی",
  weak_match: "تناسب ضعیف",
  not_recommended: "توصیه نمی‌شود",
  needs_more_information: "نیازمند اطلاعات بیشتر",
};

interface JobDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [detail, setDetail] = useState<JobMatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState<"saved" | "dismissed" | null>(
    null,
  );

  const [aiResult, setAiResult] = useState<MatchDecisionResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await getJobMatchDetail(id);
      setDetail(data);
    } catch (error) {
      console.error("خطا در بارگذاری جزئیات آگهی:", error);
      setLoadError(
        error instanceof Error ? error.message : "دریافت جزئیات آگهی ناموفق بود.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }

    void loadDetail();
  }, [loadDetail, router]);

  async function handleFeedback(relevant: boolean) {
    setFeedbackBusy(true);

    try {
      await sendJobFeedback(id, relevant);
      setFeedbackDone(relevant ? "saved" : "dismissed");
    } catch (error) {
      console.error("خطا در ثبت بازخورد آگهی:", error);
    } finally {
      setFeedbackBusy(false);
    }
  }

  async function runAiAnalysis() {
    setAiLoading(true);
    setAiError(null);

    try {
      const data = await api<{ match_result: MatchDecisionResult }>(
        "/match/analyze/",
        {
          method: "POST",
          body: JSON.stringify({ job_id: id, explain_with_llm: true }),
        },
      );

      setAiResult(data.match_result);
    } catch (error) {
      console.error("خطا در تحلیل هوشمند آگهی:", error);
      setAiError(
        error instanceof Error ? error.message : "تحلیل هوشمند آگهی ناموفق بود.",
      );
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <main
      className="flex min-h-screen gap-4 p-4 md:p-6"
      style={{ background: jobsTheme.pageBg, color: jobsTheme.text }}
    >
      <JobsSidebar />

      <div className="mx-auto w-full max-w-3xl pb-20">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-sm">
          <Link
            href="/jobs"
            className="flex items-center gap-1 font-bold"
            style={{ color: jobsTheme.primaryDark }}
          >
            <ArrowRight className="size-4" />
            مشاغل
          </Link>
          <ChevronLeft className="size-3" style={{ color: jobsTheme.textFaint }} />
          <span style={{ color: jobsTheme.textMuted }}>
            {detail?.job.title ?? "جزئیات آگهی"}
          </span>
        </div>

        {loading ? (
          <div
            className="rounded-3xl p-10 text-center text-sm"
            style={{ backgroundColor: jobsTheme.card, color: jobsTheme.textMuted }}
          >
            در حال بارگذاری جزئیات آگهی…
          </div>
        ) : loadError || !detail ? (
          <div
            className="space-y-3 rounded-3xl p-8 text-center"
            style={{ backgroundColor: jobsTheme.card }}
          >
            <p className="text-sm font-bold" style={{ color: jobsTheme.danger }}>
              بارگذاری جزئیات آگهی ناموفق بود.
            </p>
            {loadError && (
              <p className="break-words text-xs" style={{ color: jobsTheme.textMuted }}>
                {loadError}
              </p>
            )}
            <button
              type="button"
              onClick={() => void loadDetail()}
              className="rounded-full px-5 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: jobsTheme.primary }}
            >
              تلاش دوباره
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Main card */}
            <div
              className="rounded-3xl p-5 shadow-sm md:p-7"
              style={{ backgroundColor: jobsTheme.card, border: `1px solid ${jobsTheme.cardBorder}` }}
            >
              <div className="flex flex-wrap items-start gap-4">
                <MatchScoreBadge score={detail.score} size="lg" withLabel />

                <div className="min-w-0 flex-1 space-y-2">
                  <h1 className="text-xl font-extrabold">{detail.job.title}</h1>
                  <p className="text-sm" style={{ color: jobsTheme.textMuted }}>
                    {detail.job.company}
                  </p>
                  <JobMetaChips job={detail.job} />
                </div>
              </div>

              {/* Action buttons */}
              <div
                className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4"
                style={{ borderColor: jobsTheme.cardBorder }}
              >
                <button
                  type="button"
                  onClick={() => void runAiAnalysis()}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-sm transition-opacity disabled:opacity-60"
                  style={{
                    background: `linear-gradient(135deg, ${jobsTheme.primary}, ${jobsTheme.primaryDark})`,
                  }}
                >
                  <Sparkles className="size-4" />
                  {aiLoading ? "در حال تحلیل…" : "تحلیل هوشمند آگهی"}
                </button>

                {feedbackDone ? (
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold"
                    style={{
                      backgroundColor:
                        feedbackDone === "saved"
                          ? jobsTheme.successSoft
                          : jobsTheme.dangerSoft,
                      color:
                        feedbackDone === "saved" ? jobsTheme.success : jobsTheme.danger,
                    }}
                  >
                    <Check className="size-4" />
                    {feedbackDone === "saved" ? "ذخیره شد" : "رد شد"}
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleFeedback(false)}
                      disabled={feedbackBusy}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-opacity disabled:opacity-60"
                      style={{ backgroundColor: jobsTheme.dangerSoft, color: jobsTheme.danger }}
                    >
                      <ThumbsDown className="size-4" />
                      نامرتبط، رد کن
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleFeedback(true)}
                      disabled={feedbackBusy}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-opacity disabled:opacity-60"
                      style={{ backgroundColor: jobsTheme.successSoft, color: jobsTheme.success }}
                    >
                      <ThumbsUp className="size-4" />
                      مناسب، ذخیره کن
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Breakdown */}
            <div
              className="rounded-3xl p-5 shadow-sm md:p-7"
              style={{ backgroundColor: jobsTheme.card, border: `1px solid ${jobsTheme.cardBorder}` }}
            >
              <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold">
                <span
                  className="flex size-6 items-center justify-center rounded-full text-xs"
                  style={{ backgroundColor: jobsTheme.primarySoft, color: jobsTheme.primaryDark }}
                >
                  %
                </span>
                تحلیل تناسب با پروفایل شما
              </h2>

              <BreakdownBars breakdown={detail.breakdown} />
            </div>

            {/* Reasons */}
            {detail.reasons.length > 0 && (
              <div
                className="rounded-3xl p-5 shadow-sm md:p-7"
                style={{ backgroundColor: jobsTheme.card, border: `1px solid ${jobsTheme.cardBorder}` }}
              >
                <h2 className="mb-4 text-sm font-extrabold">دلایل تناسب</h2>
                <ReasonsList reasons={detail.reasons} />
              </div>
            )}

            {/* Missing skills */}
            {detail.missing_skills.length > 0 && (
              <div
                className="rounded-3xl p-5 shadow-sm md:p-7"
                style={{ backgroundColor: jobsTheme.card, border: `1px solid ${jobsTheme.cardBorder}` }}
              >
                <h2 className="mb-3 text-sm font-extrabold">مهارت‌های گمشده</h2>
                <SkillChips skills={detail.missing_skills} tone="danger" size="md" />
              </div>
            )}

            {/* AI deep analysis */}
            {aiError && (
              <div
                className="rounded-3xl p-5 text-sm"
                style={{ backgroundColor: jobsTheme.dangerSoft, color: jobsTheme.danger }}
              >
                تحلیل هوشمند ناموفق بود: {aiError}
              </div>
            )}

            {aiResult && (
              <div
                className="space-y-4 rounded-3xl p-5 shadow-sm md:p-7"
                style={{
                  backgroundColor: jobsTheme.card,
                  border: `1px solid ${jobsTheme.cardBorder}`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-extrabold">
                    <Sparkles
                      className="size-4"
                      style={{ color: jobsTheme.primaryDark }}
                    />
                    تحلیل هوشمند عمیق (AI)
                  </h2>

                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{ backgroundColor: jobsTheme.primarySoft, color: jobsTheme.primaryDark }}
                  >
                    {DECISION_LABELS[aiResult.overall_decision] ||
                      aiResult.overall_decision}{" "}
                    · {aiResult.overall_score}٪
                  </span>
                </div>

                <p className="text-sm leading-7" style={{ color: jobsTheme.text }}>
                  {aiResult.reasoning}
                </p>

                {aiResult.matching_skills.length > 0 && (
                  <div>
                    <div
                      className="mb-1.5 text-xs font-bold"
                      style={{ color: jobsTheme.textMuted }}
                    >
                      مهارت‌های تأییدشده
                    </div>
                    <SkillChips skills={aiResult.matching_skills} tone="success" />
                  </div>
                )}

                {aiResult.missing_required_skills.length > 0 && (
                  <div>
                    <div
                      className="mb-1.5 text-xs font-bold"
                      style={{ color: jobsTheme.textMuted }}
                    >
                      مهارت‌های الزامی بدون شواهد
                    </div>
                    <SkillChips
                      skills={aiResult.missing_required_skills}
                      tone="danger"
                    />
                  </div>
                )}

                {aiResult.recommendation && (
                  <p
                    className="rounded-2xl p-3 text-sm"
                    style={{ backgroundColor: jobsTheme.primarySofter, color: jobsTheme.text }}
                  >
                    {aiResult.recommendation}
                  </p>
                )}
              </div>
            )}

            {/* Description */}
            {detail.job.description && (
              <div
                className="rounded-3xl p-5 shadow-sm md:p-7"
                style={{ backgroundColor: jobsTheme.card, border: `1px solid ${jobsTheme.cardBorder}` }}
              >
                <h2 className="mb-3 text-sm font-extrabold">توضیحات آگهی</h2>
                <p
                  className="whitespace-pre-wrap text-sm leading-8"
                  style={{ color: jobsTheme.textMuted }}
                >
                  {detail.job.description}
                </p>

                {detail.job.url && (
                  <a
                    href={detail.job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm font-bold"
                    style={{ color: jobsTheme.primaryDark }}
                  >
                    مشاهده‌ی آگهی اصلی ←
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
