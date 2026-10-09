
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RetroWindow, RetroButton, RetroCard } from "@/components/retro";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <RetroWindow title="📋 همراه.exe" className="w-full">
          <div className="space-y-6">
            <header className="text-center">
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                به همراه.exe خوش‌آمدی
              </h1>
              <p className="text-[var(--text-secondary)]">
                یاور هوشمند برای یافتن فرصت شغلی مناسب
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/jobs" className="block">
                <RetroCard
                  variant="solid"
                  className="cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors h-full"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-4xl">💼</div>
                    <h2 className="font-bold text-[var(--text-primary)]">
                      فید آگهی‌ها
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)] text-center">
                      مشاهده آگهی‌های شغلی و تطابق با پروفایل تو
                    </p>
                  </div>
                </RetroCard>
              </Link>

              <Link href="/resume" className="block">
                <RetroCard
                  variant="solid"
                  className="cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors h-full"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-4xl">📄</div>
                    <h2 className="font-bold text-[var(--text-primary)]">
                      رزومه من
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)] text-center">
                      مدیریت و تأیید اطلاعات رزومه
                    </p>
                  </div>
                </RetroCard>
              </Link>

              <Link href="/interview" className="block">
                <RetroCard
                  variant="solid"
                  className="cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors h-full"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-4xl">🎤</div>
                    <h2 className="font-bold text-[var(--text-primary)]">
                      شبیه‌ساز مصاحبه
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)] text-center">
                      تمرین برای مصاحبه‌های شغلی
                    </p>
                  </div>
                </RetroCard>
              </Link>

              <Link href="/settings" className="block">
                <RetroCard
                  variant="solid"
                  className="cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors h-full"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-4xl">⚙️</div>
                    <h2 className="font-bold text-[var(--text-primary)]">
                      تنظیمات
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)] text-center">
                      مدیریت پروفایل و ترجیحات
                    </p>
                  </div>
                </RetroCard>
              </Link>
            </div>

            <RetroCard variant="default" title="💡 نکات مهم">
              <ul className="space-y-2 text-sm text-[var(--text-primary)]">
                <li>• فید آگهی‌ها بر اساس پروفایل تو تطبیق داده می‌شود.</li>
                <li>• می‌توانی مهارت‌های خود را اضافه و تأیید کنی.</li>
                <li>• شبیه‌ساز مصاحبه برای آمادگی بیشتر طراحی شده است.</li>
                <li>• اطلاعاتت باید به‌صورت امن نگهداری شوند.</li>
              </ul>
            </RetroCard>

            <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)]">
              <RetroButton
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={() => router.push("/onboarding")}
              >
                شروع و تکمیل پروفایل
              </RetroButton>

              
<RetroButton
  size="lg"
  className="flex-1"
  onClick={() => router.push("/guide")}
>
  راهنما و شروع کار
</RetroButton>
        
            </div>
          </div>
        </RetroWindow>
      </div>
    </main>
  );
}