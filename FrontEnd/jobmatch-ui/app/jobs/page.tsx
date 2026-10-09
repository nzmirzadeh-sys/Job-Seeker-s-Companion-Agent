"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api, getToken, type MatchRow } from "@/lib/api";
import { toast } from "sonner";
import {
  Building2,
  FileText,
  MapPin,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  Banknote,
  Briefcase,
  LogOut,
} from "lucide-react";

const LEVEL_FA: Record<string, string> = {
  intern: "کارآموز",
  junior: "جونیور",
  mid: "میان‌رده",
  senior: "ارشد",
};

function scoreColor(s: number): string {
  if (s >= 70) return "emerald";
  if (s >= 45) return "amber";
  return "rose";
}

function ScoreBadge({ score }: { score: number }) {
  const c = scoreColor(score);
  const cls =
    c === "emerald"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : c === "amber"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-rose-50 text-rose-700 border-rose-200";
  return (
    <div className={`shrink-0 rounded-xl border-2 text-center w-14 py-1.5 ${cls}`}>
      <div className="text-base font-black leading-none">{score}</div>
      <div className="text-[9px] font-medium mt-0.5 opacity-70">از ۱۰۰</div>
    </div>
  );
}

function clearAuth() {
  if (typeof window !== "undefined") localStorage.removeItem("jm_access");
}

export default function JobsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ count: number; results: MatchRow[] }>("/jobs/feed/?limit=20");
      setRows(data.results);
    } catch {
      toast.error("خطا در بارگذاری آگهی‌ها. لطفاً دوباره وارد شوید.");
      router.replace("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace("/"); return; }
    loadFeed();
  }, [loadFeed, router]);

  async function scrape() {
    setScraping(true);
    try {
      const data = await api<{ note: string; created_count: number }>("/jobs/scrape/", { method: "POST" });
      toast.success(`${data.created_count} آگهی جدید یافت شد.`);
      loadFeed();
    } catch {
      toast.error("خطا در جست‌وجوی منابع.");
    } finally {
      setScraping(false);
    }
  }

  return (
    <main className="flex-1 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top nav */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <Sparkles className="size-4" />
            </div>
            <span className="font-bold text-sm">همراه کاریابی</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/analyzer")}
              className="text-indigo-600 dark:text-indigo-400 text-xs h-8 px-2.5"
            >
              <Sparkles className="size-3.5 ml-1" />
              تحلیل آگهی
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/resume")}
              className="text-xs h-8 px-2.5"
            >
              <FileText className="size-3.5 ml-1" />
              رزومه
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { clearAuth(); router.push("/"); }}
              className="text-xs h-8 px-2 text-muted-foreground"
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-5 space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base">فرصت‌های شغلی</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? "در حال محاسبه تناسب…" : `${rows.length} آگهی — مرتب‌شده بر اساس تناسب`}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={scrape}
            disabled={scraping || loading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${scraping ? "animate-spin" : ""}`} />
            {scraping ? "در حال جست‌وجو…" : "به‌روزرسانی"}
          </Button>
        </div>

        {/* Feed */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-28 bg-white dark:bg-slate-900 rounded-xl animate-pulse border border-slate-200 dark:border-slate-800" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Card className="border-dashed border-2 shadow-none">
            <CardContent className="p-12 text-center space-y-3">
              <div className="size-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
                <Briefcase className="size-6" />
              </div>
              <div>
                <div className="font-bold">هنوز آگهی‌ای وجود ندارد</div>
                <div className="text-sm text-muted-foreground mt-1">با دکمه «به‌روزرسانی» آگهی‌های جدید را بارگذاری کن</div>
              </div>
              <Button size="sm" onClick={scrape} disabled={scraping}>
                <RefreshCw className="size-4 ml-1.5" />
                جست‌وجوی آگهی
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <button
                key={row.id}
                onClick={() => router.push(`/jobs/${row.job.id}`)}
                className="w-full text-right"
              >
                <Card className="hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-150 cursor-pointer group">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="size-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Building2 className="size-5" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm leading-snug group-hover:text-indigo-600 transition-colors truncate">
                              {row.job.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                              <span className="font-medium text-foreground/80">{row.job.company}</span>
                              {row.job.city && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="size-3" />
                                  {row.job.city}
                                </span>
                              )}
                              {row.job.level && (
                                <span className="flex items-center gap-1">
                                  <Briefcase className="size-3" />
                                  {LEVEL_FA[row.job.level] || row.job.level}
                                </span>
                              )}
                            </div>
                          </div>
                          <ScoreBadge score={row.score} />
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {row.job.job_types?.includes("remote") && (
                            <Badge variant="success" className="text-[10px] h-5 px-2">دورکاری</Badge>
                          )}
                          {row.job.job_types?.includes("hybrid") && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-2">هیبرید</Badge>
                          )}
                          {(row.job.salary_min || row.job.salary_max) && (
                            <Badge variant="outline" className="text-[10px] h-5 px-2 text-emerald-700 border-emerald-200 gap-0.5">
                              <Banknote className="size-2.5" />
                              {row.job.salary_min ? row.job.salary_min.toLocaleString("fa-IR") : "—"}
                              {row.job.salary_max ? ` – ${row.job.salary_max.toLocaleString("fa-IR")}` : "+"}
                              <span className="opacity-70 mr-0.5">ت</span>
                            </Badge>
                          )}
                          {row.missing_skills?.slice(0, 2).map((s) => (
                            <Badge key={s} variant="warning" className="text-[10px] h-5 px-2">−{s}</Badge>
                          ))}
                        </div>

                        {/* Progress + reason */}
                        <div className="space-y-1 pt-0.5">
                          <Progress value={row.score} className="h-1.5 progress-rtl" />
                          {row.reasons?.[0] && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1">
                              {row.reasons[0]}
                            </p>
                          )}
                        </div>
                      </div>

                      <ChevronLeft className="size-4 text-muted-foreground group-hover:text-indigo-500 transition-colors shrink-0 self-center" />
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
