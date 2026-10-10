'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { login, register } from '@/lib/api';

const Karvia3DMark = dynamic(() => import('@/components/karvia-3d-mark'), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] w-full rounded-[30px] border border-white/15 bg-[radial-gradient(circle_at_center,_rgba(139,92,246,0.18),rgba(7,6,20,0.2)_45%,rgba(7,6,20,0.8))] shadow-[0_30px_120px_rgba(11,8,30,0.8)]" />
  ),
});

export default function GlassCoreHero() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        await register(username, password, email || undefined);
      }

      const data = await login(username, password);
      router.replace(data.profile_completed ? '/jobs' : '/onboarding');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'ارتباط با سرور برقرار نشد. مطمئن شو بک‌اند اجراست.'
      );
    } finally {
      setLoading(false);
    }
  }

  const cardTitle = mode === 'login' ? 'خوش برگشتی!' : 'به کاروویا بپیوند';
  const submitLabel = mode === 'login' ? 'ورود' : 'ثبت‌نام';

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,_#1b1147_0%,_#0e0b2b_32%,_#070614_72%)] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-16 h-[360px] w-[360px] rounded-full bg-violet-600/30 blur-[120px]" />
        <div className="absolute right-0 top-20 h-[420px] w-[420px] rounded-full bg-indigo-500/30 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-fuchsia-500/20 blur-[120px]" />
      </div>

      <section className="relative z-10 mx-auto flex min-h-screen max-w-[1200px] items-center justify-center px-4 py-6 md:px-6 lg:px-8">
        <div className="flex w-full max-w-[1100px] flex-col items-center gap-8 md:flex-row md:justify-between md:gap-10">
          <motion.div
            initial={{ opacity: 0, x: -24, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="relative flex w-full flex-1 items-center justify-center md:justify-start"
          >
            <div className="relative flex h-[420px] w-full max-w-[520px] items-center justify-center overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_center,_rgba(88,72,184,0.22),_rgba(7,6,20,0.12)_42%,_rgba(7,6,20,0.02)_100%)] shadow-[0_30px_120px_rgba(11,8,30,0.8)]">
              <div className="absolute inset-x-6 top-4 h-20 rounded-full bg-violet-500/10 blur-2xl" />
              <div className="absolute -bottom-4 right-8 h-24 w-24 rounded-full bg-indigo-500/15 blur-3xl" />
              <div className="relative w-full scale-[0.9] md:scale-[0.98]">
                <Karvia3DMark />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 28, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.28 }}
            className="w-full max-w-[440px]"
          >
            <div className="rounded-[1.75rem] border border-white/15 bg-[rgba(255,255,255,0.06)] p-4 shadow-[0_20px_60px_rgba(8,6,30,0.45)] backdrop-blur-2xl [box-shadow:inset_0_1.5px_2px_rgba(255,255,255,0.35)] md:p-5">
              <div className="mb-5 flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,_rgba(196,181,253,0.33),_rgba(91,78,213,0.28))] border border-violet-200/30 text-sm font-black text-[#F4F2FF]">
                    K
                  </div>
                  <div>
                    <div className="text-[10px] tracking-[0.18em] text-[#C4B5FD]">KARVIA</div>
                    <div className="text-[11px] text-[#A9A4D0]">همراه هوشمند مسیر شغلی شما</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]" />
                  آنلاین
                </div>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-white/5 p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className={`relative rounded-full px-3 py-2 text-sm font-medium transition ${
                    mode === 'login'
                      ? 'bg-[linear-gradient(135deg,#4F46E5_0%,#8B5CF6_100%)] text-white shadow-[0_10px_25px_rgba(99,102,241,0.35)]'
                      : 'text-[#D9D3F2]'
                  }`}
                  aria-pressed={mode === 'login'}
                >
                  ورود
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className={`relative rounded-full px-3 py-2 text-sm font-medium transition ${
                    mode === 'register'
                      ? 'bg-[linear-gradient(135deg,#4F46E5_0%,#8B5CF6_100%)] text-white shadow-[0_10px_25px_rgba(99,102,241,0.35)]'
                      : 'text-[#D9D3F2]'
                  }`}
                  aria-pressed={mode === 'register'}
                >
                  ثبت‌نام
                </button>
              </div>

              <div className="mb-4">
                <h1 className="text-2xl font-black text-white">{cardTitle}</h1>
                <p className="mt-1 text-sm text-[#A9A4D0]">
                  {mode === 'login'
                    ? 'برای ادامه وارد حساب خودت شو.'
                    : 'حساب بساز و مسیر شغلی‌ات را شروع کن.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="homepage-username" className="block text-xs text-[#C4B5FD]">
                    نام کاربری
                  </label>
                  <input
                    id="homepage-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    className="h-[48px] w-full rounded-xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 text-sm text-white placeholder:text-[#A9A4D0] outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
                    placeholder="نام کاربری"
                  />
                </div>

                {mode === 'register' && (
                  <div className="space-y-2">
                    <label htmlFor="homepage-email" className="block text-xs text-[#C4B5FD]">
                      ایمیل
                    </label>
                    <input
                      id="homepage-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="h-[48px] w-full rounded-xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 text-sm text-white placeholder:text-[#A9A4D0] outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
                      placeholder="name@example.com"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="homepage-password" className="block text-xs text-[#C4B5FD]">
                    رمز عبور
                  </label>
                  <div className="relative">
                    <input
                      id="homepage-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={mode === 'register' ? 4 : undefined}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      className="h-[48px] w-full rounded-xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 pl-10 text-sm text-white placeholder:text-[#A9A4D0] outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
                      placeholder="رمز عبور"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute left-3 top-1/2 flex -translate-y-1/2 items-center justify-center text-[#C4B5FD] transition hover:text-white"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-[52px] w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#4F46E5_0%,#8B5CF6_100%)] text-base font-bold text-white shadow-[0_18px_30px_rgba(94,80,255,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? 'در حال انجام…' : submitLabel}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between gap-2 text-xs text-[#A9A4D0]">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                  مسیر شغلی هوشمند
                </span>
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="text-[#E9E5FF] underline decoration-violet-300/60 underline-offset-4 transition hover:text-white"
                >
                  ورود کامل صفحه
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
