'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BriefcaseBusiness,
  BrainCircuit,
  CheckCheck,
  FileText,
  Mic,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { assistantApi } from '@/lib/assistant/api';
import { enrichProfileFromInput } from '@/lib/assistant/parse';
import type {
  AssistantJobCard,
  AssistantMessage,
  AssistantProfile,
  AssistantQuickAction,
  AssistantStage,
} from '@/lib/assistant/types';
import { getToken } from '@/lib/api';

const STORAGE_KEY = 'karvia-assistant-session-v1';

const quickActions: Array<{ key: AssistantQuickAction; label: string; icon: typeof BriefcaseBusiness; description: string }> = [
  { key: 'find_jobs', label: 'پیدا کردن شغل', icon: BriefcaseBusiness, description: 'مطابق مهارت‌ها و علایق' },
  { key: 'resume_analysis', label: 'تحلیل رزومه', icon: FileText, description: 'امتیاز و نقاط قابل بهبود' },
  { key: 'interview_prep', label: 'آمادگی مصاحبه', icon: CheckCheck, description: 'سؤال‌های محتمل و تمرین' },
  { key: 'growth_path', label: 'مسیر رشد', icon: BrainCircuit, description: 'مهارت‌های بعدی برای ارتقا' },
];

const intakeQuestions = [
  { key: 'role', title: 'نقش یا حوزه کاری مدنظرت چه است؟', options: ['فرانت‌اند', 'بک‌اند', 'دیتا', 'طراحی محصول', 'فول‌استک'] },
  { key: 'experience', title: 'سطح تجربه‌ات چقدر است؟', options: ['مبتدی', 'سطح Junior', 'سطح Mid', 'Senior', 'Lead'] },
  { key: 'remote', title: 'ترجیح می‌دی کجا کار کنی؟', options: ['دورکاری', 'Hybrid', 'آفلاین/محلی', 'هر سه'] },
  { key: 'skills', title: 'مهارت‌های اصلی‌ات چه چیزهایی است؟', options: ['React', 'TypeScript', 'Next.js', 'Python', 'SQL', 'UI/UX', 'Figma'] },
  { key: 'expectations', title: 'انتظارات اضافی‌ات چیست؟', options: ['فعلاً مهم نیست', 'حقوق مناسب', 'رشد سریع', 'تیم قوی', 'دورکاری'] },
] as const;

const defaultProfile: AssistantProfile = { skills: [] };

function toPillLabel(value: string | undefined) {
  return value || 'فعلاً مهم نیست';
}

export default function AssistantPage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [stage, setStage] = useState<AssistantStage>('start');
  const [profile, setProfile] = useState<AssistantProfile>(defaultProfile);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 1,
      role: 'assistant',
      content: 'سلام! من کاروویا هستم. بگو دنبال چه کاری می‌گردی تا بهترین فرصت‌ها را برایت پیدا کنم.',
    },
  ]);
  const [input, setInput] = useState('');
  const [jobs, setJobs] = useState<AssistantJobCard[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }

    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as {
          profile?: AssistantProfile;
          messages?: AssistantMessage[];
          jobs?: AssistantJobCard[];
          stage?: AssistantStage;
          currentStep?: number;
        };
        if (saved.profile) setProfile(saved.profile);
        if (saved.messages?.length) setMessages(saved.messages);
        if (saved.jobs) setJobs(saved.jobs);
        if (saved.stage) setStage(saved.stage);
        if (typeof saved.currentStep === 'number') setCurrentStep(saved.currentStep);
      } catch {
        // ignore invalid persisted state
      }
    }
  }, [router]);

  useEffect(() => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profile, messages, jobs, stage, currentStep }),
    );
  }, [profile, messages, jobs, stage, currentStep]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing, stage]);

  const currentQuestion = useMemo(() => intakeQuestions[currentStep], [currentStep]);

  const appendAssistantMessage = (content: string) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'assistant', content }]);
  };

  const appendUserMessage = (content: string) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'user', content }]);
  };

  const startTypingAssistant = (content: string) => {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      appendAssistantMessage(content);
    }, 700);
  };

  const handleQuickAction = async (key: AssistantQuickAction) => {
    setError(null);
    setBusy(true);

    if (key === 'find_jobs') {
      setStage('intake');
      setCurrentStep(0);
      setBusy(false);
      return;
    }

    try {
      const result =
        key === 'resume_analysis'
          ? await assistantApi.getResumeInsight()
          : key === 'interview_prep'
            ? await assistantApi.getInterviewPrep()
            : await assistantApi.getGrowthPath();
      appendUserMessage(`بررسی ${result.title}`);
      startTypingAssistant(result.summary);
    } catch {
      setError('درخواست شما به‌درستی انجام نشد. دوباره تلاش کن.');
    } finally {
      setBusy(false);
    }
  };

  const handleChipSelect = (value: string) => {
    if (!currentQuestion) return;
    const nextProfile = { ...profile, skills: [...profile.skills] };

    if (currentQuestion.key === 'skills') {
      const skillSet = new Set(nextProfile.skills ?? []);
      if (skillSet.has(value)) skillSet.delete(value);
      else skillSet.add(value);
      nextProfile.skills = Array.from(skillSet);
    } else {
      nextProfile[currentQuestion.key as keyof AssistantProfile] = value as never;
    }

    setProfile(nextProfile);
    setInput(value);
  };

  const handleInputSubmit = () => {
    if (!currentQuestion) return;

    const raw = input.trim();
    if (!raw) {
      const fallback = currentQuestion.options[0];
      if (!fallback) return;
      handleChipSelect(fallback);
      return;
    }

    const nextProfile = enrichProfileFromInput(raw, profile);
    if (currentQuestion.key === 'skills') {
      nextProfile.skills = [...new Set([...nextProfile.skills, ...raw.split(/[,،]/).map((p) => p.trim()).filter(Boolean)])];
    } else {
      nextProfile[currentQuestion.key as keyof AssistantProfile] = raw as never;
    }
    setProfile(nextProfile);
    setInput('');
  };

  const proceedToNextStep = () => {
    if (!currentQuestion) return;

    const value = input.trim() || profile[currentQuestion.key as keyof AssistantProfile]?.toString() || '';
    if (value) {
      const nextProfile = enrichProfileFromInput(value, profile);
      if (currentQuestion.key === 'skills') {
        nextProfile.skills = [...new Set([...nextProfile.skills, ...value.split(/[،,]/).map((item) => item.trim()).filter(Boolean)])];
      } else {
        nextProfile[currentQuestion.key as keyof AssistantProfile] = value as never;
      }
      setProfile(nextProfile);
    }

    if (currentStep < intakeQuestions.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setInput('');
      return;
    }

    setStage('confirm');
  };

  const runSearch = async () => {
    setBusy(true);
    setError(null);
    try {
      const results = await assistantApi.getAssistantJobs(profile);
      setJobs(results);
      setStage('results');
      appendUserMessage('تأیید و پیدا کردن فرصت‌ها');
      startTypingAssistant(`در حال آماده‌سازی ${results.length} فرصت مناسب برایت هست. روی هر کارت می‌توانید جزئیات را ببینید.`);
    } catch {
      setError('نتیجه‌ها بارگذاری نشدند؛ دوباره تلاش کن.');
    } finally {
      setBusy(false);
    }
  };

  const saveJob = async (job: AssistantJobCard) => {
    const ok = await assistantApi.saveAssistantJob(job.id);
    if (ok) {
      appendAssistantMessage(`آگهی «${job.title}» در لیست ذخیره‌شده‌ها قرار گرفت.`);
    } else {
      appendAssistantMessage('ذخیره‌سازی انجام نشد؛ بعداً دوباره تلاش کنید.');
    }
  };

  const resetAssistant = () => {
    setStage('start');
    setCurrentStep(0);
    setProfile(defaultProfile);
    setJobs([]);
    setInput('');
    setError(null);
    setMessages([{ id: 1, role: 'assistant', content: 'سلام! من کاروویا هستم. بگو دنبال چه کاری می‌گردی تا بهترین فرصت‌ها را برایت پیدا کنم.' }]);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,_#1b1147_0%,_#0e0b2b_32%,_#070614_72%)] px-4 py-6 text-white md:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-16 h-[420px] w-[420px] rounded-full bg-violet-600/30 blur-[120px]" />
        <div className="absolute bottom-20 right-0 h-[360px] w-[360px] rounded-full bg-indigo-500/25 blur-[120px]" />
        <div className="absolute left-1/3 top-1/4 h-[240px] w-[240px] rounded-full bg-fuchsia-500/20 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[880px]">
        <div className="mb-6 flex items-center justify-between text-sm text-[#C4B5FD]">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">دستیار هوشمند کاروویا</span>
          <button
            onClick={() => router.push('/')}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[#E9E5FF] transition hover:border-violet-300/60 hover:bg-white/10"
          >
            خروج
          </button>
        </div>

        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-3 text-3xl font-black text-white md:text-5xl">
          امروز دنبال چه مسیری هستی؟
        </motion.h1>
        <p className="mb-6 text-base text-[#A9A4D0]">سلام {profile.name || 'کاربر'}، به کمک من فرصت‌های مناسب‌ات را پیدا می‌کنیم.</p>

        <div className="rounded-[2rem] border border-white/15 bg-white/6 p-3 shadow-[0_20px_70px_rgba(8,6,30,0.55)] backdrop-blur-2xl">
          <header className="mb-4 flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/7 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/25 bg-gradient-to-br from-violet-500/40 to-indigo-500/30 text-[#F5F3FF]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-bold text-white">کاروویا</div>
                <div className="text-xs text-[#A9A4D0]">آنلاین · نسخه ۱</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-[#E9E5FF]">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                حالت: دقیق
              </span>
              <button
                aria-label="Reset conversation"
                onClick={resetAssistant}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl text-white transition hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div ref={scrollRef} aria-live="polite" className="max-h-[620px] space-y-4 overflow-y-auto rounded-[1.5rem] bg-[rgba(10,12,28,0.38)] p-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl border px-4 py-3 text-sm leading-7 ${
                    message.role === 'user'
                      ? 'border-indigo-400/30 bg-indigo-500/12 text-[#F5F3FF]'
                      : 'border-white/10 bg-white/6 text-[#F0EEFF]'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                  <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="h-2 w-2 rounded-full bg-violet-200" />
                  <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.15 }} className="h-2 w-2 rounded-full bg-violet-200" />
                  <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.3 }} className="h-2 w-2 rounded-full bg-violet-200" />
                </div>
              </div>
            )}

            {stage === 'start' && (
              <div className="space-y-3 pt-2">
                <p className="text-xs font-medium tracking-[0.2em] text-[#C4B5FD]">اقدام‌های سریع</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {quickActions.map(({ key, label, description, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void handleQuickAction(key)}
                      className="group rounded-[1.35rem] border border-white/10 bg-white/5 p-4 text-right transition hover:-translate-y-0.5 hover:border-violet-300/40 hover:bg-white/8"
                    >
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 via-indigo-500/25 to-purple-500/20 text-[#F4F0FF]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-base font-bold text-white">{label}</div>
                      <div className="mt-1 text-xs text-[#A9A4D0]">{description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {stage === 'intake' && currentQuestion && (
              <div className="rounded-[1.5rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-[#A9A4D0]">
                  <span>مرحله {currentStep + 1} از {intakeQuestions.length}</span>
                  <span className="rounded-full border border-white/10 px-2 py-1">{currentQuestion.title}</span>
                </div>

                <div className="mb-4 text-lg font-bold text-white">{currentQuestion.title}</div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {currentQuestion.options.map((option) => {
                    const selected = currentQuestion.key === 'skills' ? profile.skills.includes(option) : profile[currentQuestion.key as keyof AssistantProfile] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => handleChipSelect(option)}
                        className={`rounded-full border px-3 py-2 text-sm transition ${
                          selected ? 'border-violet-300/60 bg-violet-500/20 text-white' : 'border-white/10 bg-white/5 text-[#EAE6FF] hover:border-violet-200/30'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-3">
                  <Search className="h-4 w-4 text-[#C4B5FD]" />
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={currentQuestion.key === 'skills' ? 'مهارت‌ها را بنویس...' : 'توضیح کوتاه...' }
                    className="w-full border-0 bg-transparent text-sm text-white placeholder:text-[#A9A4D0] focus:outline-none"
                  />
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#EAE6FF]">
                    برگشت
                  </button>
                  <button type="button" onClick={handleInputSubmit} className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-bold text-white">
                    ذخیره و ادامه
                  </button>
                </div>
              </div>
            )}

            {stage === 'confirm' && (
              <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-4">
                <div className="text-lg font-bold text-white">هدف شغلی تو</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    toPillLabel(profile.role),
                    toPillLabel(profile.experience),
                    toPillLabel(profile.remote),
                    ...profile.skills.slice(0, 4),
                  ].map((item) => (
                    <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-[#F4F1FF]">
                      {item}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => setStage('intake')} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[#F5F4FF]">
                    ویرایش
                  </button>
                  <button type="button" onClick={() => void runSearch()} className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-bold text-white">
                    تأیید و پیدا کردن فرصت‌ها
                  </button>
                </div>
              </div>
            )}

            {stage === 'results' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-white">{jobs.length} فرصت مناسب پیدا شد</div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setStage('intake')} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">بهبود جستجو</button>
                    <button type="button" onClick={resetAssistant} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">شروع دوباره</button>
                  </div>
                </div>

                {jobs.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/4 p-6 text-center text-[#A9A4D0]">
                    هنوز فرصت‌هایی برای نمایش وجود ندارد.
                  </div>
                ) : (
                  jobs.map((job) => (
                    <div key={job.id} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-bold text-white">{job.title}</div>
                          <div className="text-sm text-[#A9A4D0]">{job.company} · {job.city}</div>
                        </div>
                        <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-violet-300/40 bg-violet-500/12">
                          <div className="absolute inset-2 rounded-full border border-violet-200/35" />
                          <span className="text-sm font-bold text-white">{job.match}%</span>
                        </div>
                      </div>

                      <div className="mb-3 flex flex-wrap gap-2">
                        {job.skills.slice(0, 3).map((skill) => (
                          <span key={skill} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-[#F4F1FF]">{skill}</span>
                        ))}
                      </div>

                      <p className="mb-4 text-sm leading-7 text-[#DAD6F5]">{job.summary}</p>

                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <button type="button" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">مشاهده</button>
                          <button type="button" onClick={() => void saveJob(job)} className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-2 text-sm font-bold text-white">ذخیره</button>
                        </div>
                        <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-100">{job.matchLabel}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {error && (
              <div className="rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 px-3 py-2">
            <Search className="h-4 w-4 text-[#C4B5FD]" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="مثلاً: توسعه‌دهنده فرانت‌اند، دورکاری، تهران…"
              className="w-full border-0 bg-transparent text-sm text-white placeholder:text-[#A9A4D0] focus:outline-none"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (stage === 'intake') {
                    proceedToNextStep();
                    return;
                  }
                  if (input.trim()) {
                    appendUserMessage(input.trim());
                    setInput('');
                    startTypingAssistant('در حال پردازش درخواست شما...');
                  }
                }
              }}
            />
            <button type="button" aria-label="Mic" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white opacity-80">
              <Mic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (stage === 'intake') {
                  proceedToNextStep();
                  return;
                }
                if (input.trim()) {
                  appendUserMessage(input.trim());
                  setInput('');
                  startTypingAssistant('در حال پردازش درخواست شما...');
                }
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_12px_24px_rgba(79,70,229,0.45)]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
