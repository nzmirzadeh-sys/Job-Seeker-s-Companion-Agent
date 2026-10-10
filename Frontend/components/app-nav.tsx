'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Briefcase,
  Brain,
  FileText,
  FlaskConical,
  LogOut,
  MessageCircle,
  Mic,
  PenLine,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { clearToken } from '@/lib/api';

type NavItem = { href: string; label: string; icon: LucideIcon };

/** نوار بالای همهٔ صفحات (به‌جز صفحهٔ اول/ورود). برای افزودن صفحهٔ جدید فقط همین فهرست را ویرایش کن. */
export const NAV_ITEMS: NavItem[] = [
  { href: '/jobs', label: 'آگهی‌ها', icon: Briefcase },
  { href: '/assistant', label: 'همراه کاریاب', icon: MessageCircle },
  { href: '/resume-wizard', label: 'ساخت رزومه', icon: FileText },
  { href: '/resume-writer', label: 'نویسندهٔ رزومه', icon: PenLine },
  { href: '/evidence-validator', label: 'اعتبارسنج شواهد', icon: ShieldCheck },
  { href: '/career', label: 'تحلیل سوابق', icon: Brain },
  { href: '/what-if', label: 'شبیه‌ساز مهارت', icon: FlaskConical },
  { href: '/interview', label: 'تمرین مصاحبه', icon: Mic },
];

const HIDDEN_ON = ['/', '/login'];

export default function AppNav() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();

  if (HIDDEN_ON.includes(pathname)) return null;

  function logout() {
    clearToken();
    router.push('/');
  }

  return (
    <nav
      dir="rtl"
      aria-label="ناوبری اصلی"
      className="relative z-50 border-b border-white/10 bg-[#0b0824]/85 shadow-[0_8px_30px_rgba(8,6,30,0.45)] backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-l from-transparent via-violet-400/60 to-transparent" />
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 md:px-5">
        <Link href="/assistant" className="flex shrink-0 items-center gap-2" aria-label="KARVIA">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-200/30 bg-[linear-gradient(135deg,rgba(196,181,253,0.4),rgba(91,78,213,0.4))] text-sm font-black text-white shadow-[0_0_18px_rgba(139,92,246,0.45)]">
            K
          </span>
          <span className="hidden text-xs font-black tracking-[0.3em] text-[#E4DDFF] sm:block">KARVIA</span>
        </Link>

        <ul className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap py-0.5 [mask-image:linear-gradient(to_left,transparent,black_12px,black_calc(100%-18px),transparent)] [scrollbar-width:none]">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-l from-violet-600/60 to-indigo-500/50 font-bold text-white shadow-[0_0_20px_rgba(139,92,246,0.4)] ring-1 ring-violet-300/50'
                      : 'text-[#CFC9F5] hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={logout}
          title="خروج"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[13px] text-[#CFC9F5] transition hover:border-red-300/50 hover:bg-red-500/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">خروج</span>
        </button>
      </div>
    </nav>
  );
}
