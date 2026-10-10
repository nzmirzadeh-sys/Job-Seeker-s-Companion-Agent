/**
 * پالت رنگی بنفش صفحه‌ی آگهی‌ها و جزئیات آگهی (نسخهٔ تیرهٔ یکپارچه با بقیهٔ اپ)
 */

export const jobsTheme = {
  pageBg:
    "radial-gradient(circle at 15% 0%, rgba(124,92,252,0.22) 0%, rgba(124,92,252,0) 45%), radial-gradient(circle at 90% 90%, rgba(79,70,229,0.16) 0%, rgba(79,70,229,0) 40%), linear-gradient(180deg, #0e0b2b 0%, #070614 100%)",
  card: "rgba(255,255,255,0.06)",
  cardBorder: "rgba(255,255,255,0.14)",
  cardBorderHover: "rgba(167,139,250,0.55)",
  text: "#F4F2FF",
  textMuted: "#B6B0DC",
  textFaint: "#8F88C2",
  primary: "#8B6CFF",
  primaryDark: "#6D45F0",
  primarySoft: "rgba(139,108,255,0.18)",
  primarySofter: "rgba(139,108,255,0.10)",
  success: "#34D399",
  successSoft: "rgba(52,211,153,0.15)",
  danger: "#FB7185",
  dangerSoft: "rgba(251,113,133,0.15)",
  warning: "#FBBF24",
  warningSoft: "rgba(251,191,36,0.15)",
  sidebarBg: "rgba(255,255,255,0.06)",
} as const;

export function scoreBand(score: number): {
  color: string;
  soft: string;
  label: string;
} {
  if (score >= 70) {
    return { color: jobsTheme.success, soft: jobsTheme.successSoft, label: "تناسب بالا" };
  }
  if (score >= 45) {
    return { color: jobsTheme.warning, soft: jobsTheme.warningSoft, label: "تناسب متوسط" };
  }
  return { color: jobsTheme.danger, soft: jobsTheme.dangerSoft, label: "تناسب پایین" };
}

export function formatSalary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => n.toLocaleString("fa-IR");
  if (min && max) return `${fmt(min)} – ${fmt(max)} تومان`;
  if (min) return `از ${fmt(min)} تومان`;
  if (max) return `تا ${fmt(max)} تومان`;
  return null;
}

export function jobTypeLabel(type: string): string {
  const map: Record<string, string> = {
    remote: "دورکاری",
    onsite: "حضوری",
    hybrid: "هیبرید",
  };
  return map[type.toLowerCase()] || type;
}

export const breakdownDimensions: Array<{
  key: "skills" | "role" | "level" | "logistics";
  label: string;
  max: number;
}> = [
  { key: "skills", label: "مهارت‌های تخصصی", max: 45 },
  { key: "role", label: "عنوان و نقش شغلی", max: 25 },
  { key: "level", label: "سطح و تجربه", max: 20 },
  { key: "logistics", label: "شرایط کاری", max: 10 },
];

export function isNegativeReason(reason: string): boolean {
  return (
    reason.includes("نیست") ||
    reason.includes("دیگری است") ||
    reason.includes("پایین‌تر")
  );
}
