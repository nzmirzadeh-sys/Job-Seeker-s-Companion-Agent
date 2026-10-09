
import Link from "next/link";

export default function InterviewPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[var(--bg-primary)] p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <h1 className="text-2xl font-bold">شبیه‌ساز مصاحبه</h1>

        <p>
          به بخش تمرین مصاحبه خوش آمدی. در این قسمت می‌توانی برای
          مصاحبه‌های شغلی آماده شوی. قابلیت تمرین تعاملی هنوز باید
          پیاده‌سازی شود.
        </p>

        <Link
          href="/"
          className="inline-block rounded-lg border px-4 py-3"
        >
          بازگشت به صفحهٔ اصلی
        </Link>
      </div>
    </main>
  );
}