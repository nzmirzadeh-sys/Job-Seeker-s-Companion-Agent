"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api, getToken, streamChat, type MatchRow } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  MapPin,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  Banknote,
  Briefcase,
  Clock,
  ExternalLink,
} from "lucide-react";

const LEVEL_FA: Record<string, string> = {
  intern: "کارآموز",
  junior: "جونیور",
  mid: "میان‌رده",
  senior: "ارشد",
};

const JOB_TYPE_FA: Record<string, string> = {
  remote: "دورکاری",
  onsite: "حضوری",
  hybrid: "هیبرید",
  fulltime: "تمام‌وقت",
  parttime: "پاره‌وقت",
  contract: "پروژه‌ای",
};

function scoreColor(s: number) {
  if (s >= 70) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (s >= 45) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-rose-600 bg-rose-50 border-rose-200";
}

function scoreLabel(s: number) {
  if (s >= 70) return "تناسب بالا";
  if (s >= 45) return "تناسب متوسط";
  return "تناسب پایین";
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackSent, setFeedbackSent] = useState<"saved" | "dismissed" | null>(null);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<MatchRow>(`/jobs/${jobId}/match/`);
      setMatch(data);
    } catch {
      toast.error("آگهی پیدا نشد.");
      router.replace("/jobs");
    } finally {
      setLoading(false);
    }
  }, [jobId, router]);

  useEffect(() => {
    if (!getToken()) { router.replace("/"); return; }
    load();
  }, [load, router]);

  async function sendFeedback(relevant: boolean) {
    if (!match) return;
    setSendingFeedback(true);
    try {
      await api(`/jobs/${match.job.id}/feedback/`, {
        method: "POST",
        body: JSON.stringify({ relevant }),
      });
      setFeedbackSent(relevant ? "saved" : "dismissed");
      toast.success(relevant ? "آگهی ذخیره شد ✓" : "آگهی رد شد");
    } catch {
      toast.error("خطا در ثبت بازخورد.");
    } finally {
      setSendingFeedback(false);
    }
  }

  if (loading) {
    return (
      <main className="flex-1 min-h-screen">
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-40 bg-muted rounded-xl animate-pulse" />
          <div className="h-60 bg-muted rounded-xl animate-pulse" />
        </div>
      </main>
    );
  }

  if (!match) return null;

  const { job } = match;

  return (
    <main className="flex-1 min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">

        {/* Back */}
        <button
          onClick={() => router.push("/jobs")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="size-4" />
          بازگشت به آگهی‌ها
        </button>

        {/* Hero card */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-l from-indigo-500 to-violet-500" />
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2 flex-1 min-w-0">
                <h1 className="text-xl font-extrabold leading-snug truncate">{job.title}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-4 shrink-0" />
                    <span className="font-medium text-foreground">{job.company}</span>
                  </span>
                  {job.city && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4 shrink-0" />
                      {job.city}
                    </span>
                  )}
                  {job.level && (
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="size-4 shrink-0" />
                      {LEVEL_FA[job.level] || job.level}
                    </span>
                  )}
                </div>
                {/* Tags row */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {job.job_types?.map((t) => (
                    <Badge key={t} variant={t === "remote" ? "success" : "secondary"} className="text-xs">
                      {JOB_TYPE_FA[t] || t}
                    </Badge>
                  ))}
                  {(job.salary_min || job.salary_max) && (
                    <Badge variant="outline" className="gap-1 text-xs text-emerald-700 border-emerald-200">
                      <Banknote className="size-3" />
                      {job.salary_min && job.salary_max
                        ? `${job.salary_min.toLocaleString("fa-IR")} – ${job.salary_max.toLocaleString("fa-IR")} تومان`
                        : job.salary_min
                        ? `از ${job.salary_min.toLocaleString("fa-IR")} تومان`
                        : `تا ${job.salary_max!.toLocaleString("fa-IR")} تومان`}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Score badge */}
              <div className={`shrink-0 rounded-2xl border-2 px-4 py-3 text-center min-w-[80px] ${scoreColor(match.score)}`}>
                <div className="text-2xl font-black">{match.score}</div>
                <div className="text-[11px] font-medium opacity-80">از ۱۰۰</div>
                <div className="text-[10px] font-semibold mt-0.5">{scoreLabel(match.score)}</div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-1 border-t">
              {feedbackSent ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  {feedbackSent === "saved"
                    ? <><CheckCircle2 className="size-4 text-emerald-500" /> آگهی ذخیره شد</>
                    : <><XCircle className="size-4 text-rose-500" /> آگهی رد شد</>}
                </div>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => sendFeedback(true)}
                    disabled={sendingFeedback}
                  >
                    <ThumbsUp className="size-3.5 ml-1.5" />
                    مناسبه، ذخیره کن
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={() => sendFeedback(false)}
                    disabled={sendingFeedback}
                  >
                    <ThumbsDown className="size-3.5 ml-1.5" />
                    نامرتبطه، رد کن
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mr-auto text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    localStorage.setItem("jm_analyze_text", job.description || job.title);
                  }
                  router.push("/analyzer");
                }}
              >
                <Sparkles className="size-3.5 ml-1.5 text-indigo-500" />
                تحلیل هوشمند آگهی
              </Button>
              {job.url && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                    <ExternalLink className="size-3.5" />
                    مشاهده اصل آگهی
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Match breakdown */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 space-y-4">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <div className="size-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black">٪</div>
              تحلیل تناسب با پروفایل شما
            </h2>
            <div className="space-y-2.5">
              {[
                { label: "مهارت‌های تخصصی", key: "skills", max: 45 },
                { label: "عنوان و نقش شغلی", key: "role", max: 25 },
                { label: "سطح و تجربه", key: "level", max: 20 },
                { label: "شرایط کاری", key: "logistics", max: 10 },
              ].map(({ label, key, max }) => {
                const val = Number((match.breakdown as Record<string, number>)?.[key]) || 0;
                const pct = (val / max) * 100;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold tabular-nums">{val}<span className="text-muted-foreground font-normal">/{max}</span></span>
                    </div>
                    <Progress value={pct} className="h-2 progress-rtl" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Reasons */}
        {match.reasons?.length ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-3">
              <h2 className="font-bold text-sm">دلایل تناسب</h2>
              <ul className="space-y-2">
                {match.reasons.map((r, i) => {
                  const isNeg = r.includes("نیست") || r.includes("خوان نیست") || r.includes("کمتر");
                  return (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      {isNeg
                        ? <XCircle className="size-4 text-rose-400 shrink-0 mt-0.5" />
                        : <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />}
                      <span className={isNeg ? "text-muted-foreground" : "text-foreground"}>{r}</span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {/* Missing skills */}
        {match.missing_skills?.length ? (
          <Card className="border-0 shadow-sm border-amber-100">
            <CardContent className="p-6 space-y-3">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Clock className="size-4 text-amber-500" />
                مهارت‌هایی که می‌توانی اضافه کنی
              </h2>
              <div className="flex flex-wrap gap-2">
                {match.missing_skills.map((s) => (
                  <Badge key={s} variant="warning" className="text-xs px-3 py-1">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Required skills */}
        {job.required_skills?.length ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-3">
              <h2 className="font-bold text-sm">مهارت‌های مورد نیاز</h2>
              <div className="flex flex-wrap gap-1.5">
                {job.required_skills.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
              {job.optional_skills?.length ? (
                <div className="space-y-2 pt-1">
                  <div className="text-xs text-muted-foreground">مهارت‌های امتیازی (اختیاری)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {job.optional_skills.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs text-muted-foreground">{s}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Description */}
        {job.description ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-3">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <FileText className="size-4 text-indigo-500" />
                توضیحات آگهی
              </h2>
              <p className="text-sm leading-loose text-muted-foreground whitespace-pre-line">
                {job.description}
              </p>
            </CardContent>
          </Card>
        ) : null}

      </div>
    </main>
  );
}
