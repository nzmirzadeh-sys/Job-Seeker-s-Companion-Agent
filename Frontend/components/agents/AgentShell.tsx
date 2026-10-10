'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

/** قالب مشترک و ساده صفحات ایجنت‌ها (تم بنفش تیره، مستقل از بقیهٔ صفحات). */
export function AgentShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!getToken()) router.replace('/');
  }, [router]);

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_top,_#1b1147_0%,_#0e0b2b_40%,_#070614_80%)] px-4 py-8 text-white md:px-8"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/30 bg-violet-500/15 px-3 py-1 text-[11px] text-[#DDD6FE]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            ایجنت هوشمند کاریاب
          </span>
          <h1 className="bg-gradient-to-l from-white to-[#C4B5FD] bg-clip-text text-3xl font-black text-transparent md:text-4xl">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-[#A9A4D0]">{subtitle}</p>
        </header>
        {children}
      </div>
    </main>
  );
}

export function Panel({
  title,
  children,
  actions,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/15 bg-white/[0.06] p-5 shadow-[0_18px_50px_rgba(8,6,30,0.35)] backdrop-blur-xl transition-colors hover:border-violet-300/30">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-bold text-[#E9E5FF]">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-xl bg-gradient-to-l from-violet-600 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-[#E9E5FF] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-red-400/50 bg-red-500/10 p-3 text-sm text-red-200">
      {message}
    </p>
  );
}

export function NoteBox({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-xl border border-amber-300/40 bg-amber-400/10 p-3 text-sm leading-7 text-amber-100">
      {children}
    </p>
  );
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'ok' | 'warn' | 'bad' | 'neutral' }) {
  const tones = {
    ok: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
    warn: 'border-amber-300/40 bg-amber-300/10 text-amber-100',
    bad: 'border-red-400/40 bg-red-400/10 text-red-200',
    neutral: 'border-white/15 bg-white/5 text-[#E9E5FF]',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${tones[tone]}`}>{children}</span>;
}

export function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export const inputClass =
  'w-full rounded-xl border border-white/15 bg-black/30 p-3 text-sm text-white placeholder:text-[#7d77a8] outline-none focus:border-violet-400';
