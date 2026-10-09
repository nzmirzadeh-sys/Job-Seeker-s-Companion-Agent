
import Link from "next/link";

export default function GuidePage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[var(--bg-primary)] p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">راهنمای همراه.exe</h1>

        <p>برای استفاده از همراه، این مراحل را دنبال کن:</p>

        <ol className="list-decimal space-y-3 pr-6">
          <li>پروفایل شغلی‌ات را تکمیل کن.</li>
          <li>مهارت‌ها و سوابق کاری‌ات را بررسی و تأیید کن.</li>
          <li>آگهی‌های شغلی را ببین و میزان تطابق را بررسی کن.</li>
          <li>رزومه‌ات را مرور کن و اطلاعات ناقص را تکمیل کن.</li>
        </ol>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/onboarding"
            className="rounded-lg bg-blue-600 px-4 py-3 text-white"
          >
            تکمیل پروفایل
          </Link>

          <Link
            href="/jobs"
            className="rounded-lg border px-4 py-3"
          >
            مشاهدهٔ آگهی‌ها
          </Link>

          <Link href="/" className="rounded-lg border px-4 py-3">
            بازگشت به خانه
          </Link>
        </div>
      </div>
    </main>
  );
}