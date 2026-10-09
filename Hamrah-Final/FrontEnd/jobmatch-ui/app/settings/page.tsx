
import Link from "next/link";

export default function SettingsPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[var(--bg-primary)] p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <h1 className="text-2xl font-bold">تنظیمات و پروفایل</h1>

        <p>
          از این بخش می‌توانی به اطلاعات رزومه و تکمیل پروفایل شغلی‌ات بروی.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/resume"
            className="rounded-lg border px-4 py-3"
          >
            مدیریت رزومه
          </Link>

          <Link
            href="/onboarding"
            className="rounded-lg border px-4 py-3"
          >
            تکمیل پروفایل
          </Link>

          <Link href="/" className="rounded-lg border px-4 py-3">
            بازگشت به خانه
          </Link>
        </div>
      </div>
    </main>
  );
}