'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Sparkles, Wand2 } from 'lucide-react';

import { login, register } from '@/lib/api';
import type { LogoPhase } from './karvia-logo-model';
import KarviaSceneGate from './karvia-scene-gate';

const INTRO_DURATION_MS = 3000;
const EASE = [0.16, 1, 0.3, 1] as const;

export default function LoginExperience() {
  const router = useRouter();
  const [phase, setPhase] = useState<LogoPhase>('intro');
  const skippedRef = useRef(false);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setPhase('main'), INTRO_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const skipIntro = useCallback(() => {
    if (skippedRef.current || phase !== 'intro') return;
    skippedRef.current = true;
    setPhase('main');
  }, [phase]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        await register(username, password, email || undefined);
      }
      const data = await login(username, password);
      router.replace(data.profile_completed ? '/assistant' : '/onboarding');
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

  // "ورود آزمایشی" uses the real backend's seeded demo account (demo / demo1234
  // created by `manage.py seed_demo`) instead of faking auth client-side, so the
  // rest of the app keeps working exactly as it does for a real user.
  async function handleGuestEntry() {
    setError('');
    setGuestLoading(true);
    try {
      const data = await login('demo', 'demo1234');
      router.replace(data.profile_completed ? '/assistant' : '/onboarding');
    } catch {
      setError(
        'حساب آزمایشی روی این سرور فعال نیست. از بک‌اند دستور «python manage.py seed_demo» را اجرا کن، یا مستقیم ثبت‌نام کن.'
      );
    } finally {
      setGuestLoading(false);
    }
  }

  const cardTitle = mode === 'login' ? 'خوش برگشتی!' : 'به کاروویا بپیوند';
  const submitLabel = mode === 'login' ? 'ورود به حساب' : 'ساخت حساب و ورود';

  return (
    <main
      className="relative min-h-screen overflow-hidden text-white"
      onClick={phase === 'intro' ? skipIntro : undefined}
    >
      {/* Background wash — slightly darker/emptier during the intro moment */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 transition-[background] duration-[1200ms] ease-out"
        style={{
          background:
            phase === 'intro'
              ? 'radial-gradient(circle at 50% 42%, #140c33 0%, #0a0720 55%, #050310 100%)'
              : 'radial-gradient(circle at center, #1b1147 0%, #0e0b2b 32%, #070614 72%)',
        }}
      />
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-16 h-[360px] w-[360px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute right-0 top-20 h-[420px] w-[420px] rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-fuchsia-500/10 blur-[120px]" />
      </div>

      {/* Full-screen 3D scene: the glass K, its slow rotation and ambient field */}
      <div className="fixed inset-0 z-0 pointer-events-auto">
        <KarviaSceneGate phase={phase} />
      </div>

      {/* Moment 1: wordmark fades in under the logo, no other UI */}
      <AnimatePresence>
        {phase === 'intro' && (
          <motion.div
            key="wordmark"
            className="pointer-events-none fixed inset-x-0 top-[64%] z-10 flex flex-col items-center gap-2"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.35 } }}
            transition={{ duration: 1, delay: 1.4, ease: EASE }}
          >
            <span className="text-sm font-black tracking-[0.55em] text-[#EFEAFF]">KARVIA</span>
            <span className="text-[11px] tracking-[0.15em] text-[#8f88c2]">
              در حال آماده‌سازی فضای شیشه‌ای…
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'intro' && (
          <motion.button
            key="skip"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              skipIntro();
            }}
            className="pointer-events-auto fixed bottom-7 inset-x-0 z-10 mx-auto w-fit text-[11px] tracking-[0.1em] text-[#726c9c] transition hover:text-[#C4B5FD]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            برای رد شدن کلیک کن
          </motion.button>
        )}
      </AnimatePresence>

      {/* Moment 2: header appears alongside the card */}
      <AnimatePresence>
        {phase === 'main' && (
          <motion.header
            key="header"
            className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-4 md:px-10"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-xl">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,_rgba(196,181,253,0.4),_rgba(91,78,213,0.32))] border border-violet-200/30 text-xs font-black text-[#F4F2FF]">
                K
              </div>
              <span className="text-[11px] font-black tracking-[0.3em] text-[#EFEAFF]">KARVIA</span>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Moment 2: the glass login/register card, sliding in from the right */}
      <section className="relative z-10 flex min-h-screen w-full items-center justify-center px-4 py-24 md:block">
        <AnimatePresence>
          {phase === 'main' && (
            <motion.div
              key="card"
              initial={{ opacity: 0, x: 90, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.85, ease: EASE, delay: 0.1 }}
              className="pointer-events-auto w-full max-w-[440px] md:absolute md:right-[6vw] md:top-1/2 md:-translate-y-1/2"
            >
              <div
                className="rounded-[1.75rem] border border-white/15 bg-[rgba(255,255,255,0.06)] p-4 shadow-[0_20px_60px_rgba(8,6,30,0.45)] backdrop-blur-2xl [box-shadow:inset_0_1.5px_2px_rgba(255,255,255,0.35)] md:p-5"
                dir="rtl"
              >
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
                    className={`rounded-full px-3 py-2 text-sm font-medium transition ${
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
                    className={`rounded-full px-3 py-2 text-sm font-medium transition ${
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
                    <label htmlFor="login-username" className="block text-xs text-[#C4B5FD]">
                      نام کاربری
                    </label>
                    <input
                      id="login-username"
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
                      <label htmlFor="login-email" className="block text-xs text-[#C4B5FD]">
                        ایمیل
                      </label>
                      <input
                        id="login-email"
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
                    <label htmlFor="login-password" className="block text-xs text-[#C4B5FD]">
                      رمز عبور
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
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
                    <p
                      role="alert"
                      className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || guestLoading}
                    className="flex h-[52px] w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#4F46E5_0%,#8B5CF6_100%)] text-base font-bold text-white shadow-[0_18px_30px_rgba(94,80,255,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? 'در حال انجام…' : submitLabel}
                  </button>

                  <button
                    type="button"
                    onClick={handleGuestEntry}
                    disabled={loading || guestLoading}
                    className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300/40 bg-white/[0.03] text-sm font-medium text-[#D9D3F2] transition hover:border-violet-300/70 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Wand2 className="h-4 w-4 text-violet-300" />
                    {guestLoading ? 'در حال ورود آزمایشی…' : 'تست — ورود بدون ثبت‌نام'}
                  </button>
                </form>

                <div className="mt-5 flex items-center justify-between text-xs text-[#A9A4D0]">
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                    مسیر شغلی هوشمند
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
