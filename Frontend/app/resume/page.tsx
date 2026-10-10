"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  listResumes,
  getTruthReport,
  getToken,
  type ResumeSummary,
  type TruthReportResponse,
  type TruthClaimItem,
} from "@/lib/api";
import RetroWindow from "@/components/retro/RetroWindow";
import { ArrowRight, FileText, RefreshCw } from "lucide-react";

// ═════════════════════════════════════════════════
// توابع کمکی صرفاً برای نمایش (بدون تغییر endpoint)
// ═════════════════════════════════════════════════

type ClaimStatus = TruthClaimItem["status"];

function getStatusBadge(status: ClaimStatus) {
  switch (status) {
    case "verified":
      return {
        bg: "#3B7A4A",
        text: "#FBF7EC",
        label: "✓ تأییدشده",
        icon: "✓",
        panelBg: "#FCE9A8",
      };
    case "needs_clarification":
      return {
        bg: "#C98A1F",
        text: "#FBF7EC",
        label: "⚠ نیاز به توضیح",
        icon: "!",
        panelBg: "#FFF3CD",
      };
    case "unsupported":
      return {
        bg: "#B23A2E",
        text: "#FBF7EC",
        label: "✕ بدون مدرک",
        icon: "✕",
        panelBg: "transparent",
      };
    default:
      // تضمین TypeScript: مقادیر غیرمجاز در API واقعی نمی‌آیند
      const _exhaustive: never = status;
      void _exhaustive;
      return {
        bg: "#8B8680",
        text: "#FBF7EC",
        label: "نامشخص",
        icon: "?",
        panelBg: "transparent",
      };
  }
}

// `overall_truth_score` در بازهٔ ۰..۱ است؛ در ۱۰۰ ضرب می‌کنیم
function scoreToPercent(score: number): number {
  if (typeof score !== "number" || isNaN(score)) return 0;
  const clamped = Math.max(0, Math.min(1, score));
  return Math.round(clamped * 100);
}

// رزومهٔ فعال را از لیست برمی‌گرداند؛ در صورت نبود، null
function findActiveResume(list: ResumeSummary[]): ResumeSummary | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const active = list.find((r) => r && r.active === true);
  return active || null;
}

// متن explanation مختصر بر اساس evidence_ref / suggestion
function buildItemExplanation(item: TruthClaimItem): string {
  if (item.status === "verified" && item.evidence_ref) {
    const ref = item.evidence_ref;
    if (ref.type === "skill") {
      return `تأیید شده از طریق مهارت: ${ref.skill_name || "مهارت"}`;
    }
    if (ref.type === "experience") {
      const parts: string[] = [];
      if (ref.title) parts.push(ref.title);
      if (ref.company) parts.push(ref.company);
      return `تأیید شده از تجربهٔ شغلی: ${parts.join(" — ") || "تجربه ثبت‌شده"}`;
    }
    if (ref.type === "project") {
      return `تأیید شده از پروژه: ${ref.name || "پروژه ثبت‌شده"}`;
    }
    return "شواهدی در Career Memory یافت شد.";
  }
  if (item.suggestion && item.suggestion.trim()) {
    return item.suggestion.trim();
  }
  return "";
}

// ═════════════════════════════════════════════════
// کامپوننت اصلی صفحه
// ═════════════════════════════════════════════════

export default function ResumePage() {
  const router = useRouter();
  const [activeResume, setActiveResume] = useState<ResumeSummary | null>(null);
  const [report, setReport] = useState<TruthReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActiveResume(null);
    setReport(null);

    try {
      // ۱) لیست رزومه‌ها
      const list = await listResumes();
      const active = findActiveResume(list);
      setActiveResume(active);

      if (!active) {
        // رزومه‌ای وجود ندارد — حالات خالی در UI مدیریت می‌شود
        return;
      }

      // ۲) گزارش حقیقت با id واقعی رزومهٔ فعال
      const tr = await getTruthReport(active.id);
      setReport(tr);
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "خطا در دریافت اطلاعات رزومه";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // احراز هویت اولیه + بارگذاری
  useEffect(() => {
    if (typeof window !== "undefined" && !getToken()) {
      router.replace("/");
      return;
    }
    loadData();
  }, [loadData, router]);

  // ═════════════════════════════════════════════
  // رندر بخش‌های مختلف
  // ═════════════════════════════════════════════

  const renderHeader = () => {
    if (!report) return null;
    const pct = scoreToPercent(report.overall_truth_score);
    const boxColor =
      pct >= 70 ? "#3B7A4A" : pct >= 45 ? "#C98A1F" : "#B23A2E";
    return (
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">گزارش تأیید رزومه</h2>
          <p className="text-xs mt-1" style={{ color: "#5A5450" }}>
            کدام‌یک از ادعاهای کمی رزومه‌ات با شواهد Career Memory تأیید شده‌اند؟
          </p>
          {activeResume && (
            <p className="text-[10px] mt-1" style={{ color: "#5A5450" }}>
              {activeResume.title} • نسخهٔ {activeResume.version} • شناسه:{" "}
              {report.resume_id}
            </p>
          )}
        </div>
        <div className="text-center">
          <div
            className="size-16 flex items-center justify-center text-2xl font-bold border-4"
            style={{
              backgroundColor: boxColor,
              borderColor: "#141311",
              color: "#FBF7EC",
            }}
          >
            {pct}٪
          </div>
          <div className="text-[10px] mt-1" style={{ color: "#5A5450" }}>
            تأییدشده
          </div>
        </div>
      </div>
    );
  };

  const renderClaims = () => {
    if (!report) return null;
    const items = report.truth_report || [];
    if (items.length === 0) {
      return (
        <div
          className="p-3 text-[11px] text-center border-2"
          style={{ borderColor: "#141311", color: "#5A5450" }}
        >
          در رزومهٔ فعلی هیچ ادعای کمی (عدد یا درصد) در بخش‌های summary /
          experiences / projects پیدا نشد تا بتوان آن را بررسی کرد.
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {items.map((item, idx) => {
          const badge = getStatusBadge(item.status);
          const sectionLabel =
            (item.context && item.context.trim()) || "خلاصه / متن رزومه";
          const explanation = buildItemExplanation(item);
          const typeLabel =
            item.claim_type === "percentage" ? "درصدی" : "کمی/عددی";
          return (
            <div
              key={idx}
              className="p-2 border-2 space-y-1"
              style={{
                backgroundColor: badge.panelBg,
                borderColor: "#141311",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div
                    className="text-[10px] font-bold"
                    style={{ color: "#5A5450" }}
                  >
                    {sectionLabel}
                    <span className="mr-2">[{typeLabel}]</span>
                  </div>
                  <div className="text-xs font-medium">{item.claim_text}</div>
                </div>
                <div
                  className="size-6 flex items-center justify-center font-bold text-xs shrink-0 border-2"
                  style={{
                    backgroundColor: badge.bg,
                    borderColor: "#141311",
                    color: badge.text,
                  }}
                >
                  {badge.icon}
                </div>
              </div>
              {explanation && (
                <div className="text-[10px]" style={{ color: "#5A5450" }}>
                  {explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderStats = () => {
    if (!report) return null;
    const rows: Array<[string, number, string]> = [
      ["✓ تأییدشده", report.verified_claims, "#3B7A4A"],
      ["! نیاز به توضیح", report.needs_clarification_claims, "#C98A1F"],
      ["✕ بدون مدرک", report.unsupported_claims, "#B23A2E"],
    ];
    return (
      <div className="grid grid-cols-3 gap-2">
        {rows.map(([label, count, color]) => (
          <div
            key={label}
            className="p-2 border-2 text-center"
            style={{ borderColor: "#141311" }}
          >
            <div className="text-[10px] font-bold" style={{ color }}>
              {label}
            </div>
            <div className="text-sm font-bold mt-1">{count}</div>
          </div>
        ))}
      </div>
    );
  };

  // ═════════════════════════════════════════════
  // خروجی اصلی
  // ═════════════════════════════════════════════

  return (
    <main
      className="theme-paper flex-1 min-h-screen p-4"
      style={{ backgroundColor: "#FBF7EC" }}
    >
      <div className="mx-auto max-w-4xl">
        <RetroWindow
          title="HAMRAH.EXE - رزومه‌ات"
          menu={[
            { title: "File" },
            { title: "Edit" },
            { title: "Format" },
            { title: "View" },
            { title: "Help" },
          ]}
          className="min-h-screen"
        >
          {loading ? (
            <div
              className="text-center py-8 text-sm"
              style={{ color: "#5A5450" }}
            >
              در حال بارگذاری گزارش تأیید…
            </div>
          ) : error ? (
            <div className="space-y-3 text-center py-6 text-xs">
              <div style={{ color: "#B23A2E" }}>{error}</div>
              <Button
                size="sm"
                className="h-7 text-xs"
                style={{
                  backgroundColor: "#F2C230",
                  color: "#141311",
                }}
                onClick={loadData}
              >
                <RefreshCw className="size-3" />
                تلاش مجدد
              </Button>
            </div>
          ) : !activeResume ? (
            // حالت: کاربر رزومه‌ای ندارد
            <div className="space-y-4 text-center py-8 text-xs">
              <FileText
                className="size-10 mx-auto"
                style={{ color: "#C98A1F" }}
              />
              <div className="font-bold">هنوز رزومه‌ای برای شما ثبت نشده است</div>
              <div style={{ color: "#5A5450" }}>
                برای شروع، رزومهٔ اولیه‌تان را از طریق ویزارد بسازید تا
                سپس گزارش حقیقت برای آن تولید گردد.
              </div>
              <div className="flex gap-2 justify-center pt-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  style={{
                    backgroundColor: "#F2C230",
                    color: "#141311",
                  }}
                  onClick={() => router.push("/resume-wizard")}
                >
                  <ArrowRight className="size-3" />
                  رفتن به ویزارد رزومه
                </Button>
              </div>
            </div>
          ) : !report ? (
            // رزومه فعال هست ولی گزارش خالی/ناموفق — دکمهٔ تلاش مجدد
            <div className="space-y-2 text-center py-8 text-xs">
              <div>گزارش حقیقت برای این رزومه در دسترس نیست.</div>
              <Button
                size="sm"
                className="h-7 text-xs mt-2"
                style={{
                  backgroundColor: "#F2C230",
                  color: "#141311",
                }}
                onClick={loadData}
              >
                <RefreshCw className="size-3" />
                دریافت گزارش
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {renderHeader()}

              <Separator style={{ backgroundColor: "#141311" }} />

              {renderClaims()}

              <Separator style={{ backgroundColor: "#141311" }} />

              {renderStats()}

              <div
                className="flex gap-2 border-t-2 pt-4 justify-between"
                style={{ borderTopColor: "#141311" }}
              >
                <div className="flex gap-2">
                  <Button
                    className="text-xs h-7"
                    style={{
                      backgroundColor: "#F2C230",
                      color: "#141311",
                    }}
                    onClick={() => router.push("/jobs")}
                  >
                    <ArrowRight className="size-3" />
                    بازگشت به آگهی‌ها
                  </Button>
                  <Button
                    variant="outline"
                    className="text-xs h-7"
                    style={{
                      borderColor: "#141311",
                      color: "#141311",
                    }}
                    onClick={() => router.push("/resume-wizard")}
                  >
                    ویرایش / ساخت مجدد
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="text-xs h-7"
                  style={{
                    borderColor: "#141311",
                    color: "#141311",
                  }}
                  onClick={loadData}
                >
                  <RefreshCw className="size-3" />
                  بروزرسانی
                </Button>
              </div>
            </div>
          )}
        </RetroWindow>
      </div>
    </main>
  );
}
