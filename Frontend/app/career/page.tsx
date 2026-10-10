'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  acceptHiddenSkill,
  analyzeCareer,
  decideSkill,
  fetchMemory,
  rejectHiddenSkill,
  type CareerAnalysis,
  type HiddenSkillSuggestion,
  type MemorySnapshot,
} from '@/lib/agents-api';
import {
  AgentShell,
  Chip,
  ErrorBox,
  GhostButton,
  NoteBox,
  Panel,
  PrimaryButton,
  errorMessage,
  inputClass,
} from '@/components/agents/AgentShell';

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'تأییدشده',
  unverified: 'تأییدنشده',
  needs_clarification: 'نیازمند توضیح',
  rejected: 'ردشده',
  pending_confirmation: 'در انتظار تأیید',
};

export default function CareerPage() {
  const [message, setMessage] = useState('');
  const [analysis, setAnalysis] = useState<CareerAnalysis | null>(null);
  const [hidden, setHidden] = useState<HiddenSkillSuggestion[]>([]);
  const [memory, setMemory] = useState<MemorySnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');

  const loadMemory = useCallback(async () => {
    try {
      setMemory(await fetchMemory());
    } catch (cause) {
      setError(errorMessage(cause, 'بارگذاری حافظهٔ شغلی ناموفق بود.'));
    }
  }, []);

  useEffect(() => {
    fetchMemory()
      .then(setMemory)
      .catch((cause) => setError(errorMessage(cause, 'بارگذاری حافظهٔ شغلی ناموفق بود.')));
  }, []);

  async function analyze() {
    setBusy(true);
    setError('');
    setAnalysis(null);
    try {
      const result = await analyzeCareer(message);
      setAnalysis(result);
      setHidden(result.persisted.hidden_skills ?? []);
      setMessage('');
      await loadMemory();
    } catch (cause) {
      setError(errorMessage(cause, 'تحلیل ناموفق بود.'));
    } finally {
      setBusy(false);
    }
  }

  async function decideHidden(skill: HiddenSkillSuggestion, accept: boolean) {
    setWorking(skill.name);
    setError('');
    try {
      if (accept) await acceptHiddenSkill(skill.name);
      else await rejectHiddenSkill(skill.name);
      setHidden((list) => list.filter((s) => s.name !== skill.name));
      await loadMemory();
    } catch (cause) {
      setError(errorMessage(cause, 'ثبت تصمیم ناموفق بود.'));
    } finally {
      setWorking('');
    }
  }

  async function decide(name: string, action: 'confirm' | 'reject') {
    setWorking(name);
    setError('');
    try {
      await decideSkill(name, action);
      await loadMemory();
    } catch (cause) {
      setError(errorMessage(cause, 'ثبت تصمیم ناموفق بود.'));
    } finally {
      setWorking('');
    }
  }

  const ci = analysis?.career_intelligence;
  const pending = memory?.skills.filter((s) => s.status === 'unverified' || s.status === 'needs_clarification') ?? [];
  const confirmed = memory?.skills.filter((s) => s.status === 'confirmed') ?? [];
  const rejected = memory?.skills.filter((s) => s.status === 'rejected') ?? [];

  return (
    <AgentShell
      title="تحلیل سوابق و مهارت‌ها"
      subtitle="درباره‌ی سوابق، پروژه‌ها و مهارت‌هایت آزاد بنویس. ایجنت فقط چیزهایی را که خودت گفته‌ای استخراج می‌کند و همه‌چیز «تأییدنشده» ثبت می‌شود تا خودت تأییدش کنی."
    >
      <Panel title="درباره‌ی خودت بنویس">
        <textarea
          rows={6}
          minLength={10}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="مثلاً: دو سال با Django و PostgreSQL در یک استارتاپ API نوشتم و در یک پروژهٔ دانشگاهی نویز سنسور را فیلتر کردم…"
          className={inputClass}
        />
        <div className="flex items-center justify-between text-xs text-[#A9A4D0]">
          <span>{message.length}/5000</span>
        </div>
        <ErrorBox message={error} />
        <PrimaryButton onClick={analyze} disabled={busy || message.trim().length < 10}>
          {busy ? 'در حال تحلیل…' : 'تحلیل کن'}
        </PrimaryButton>
      </Panel>

      {ci && (
        <Panel title="نتیجهٔ تحلیل">
          {ci.reply && <p className="text-sm leading-7">{ci.reply}</p>}
          <div className="grid gap-3 text-sm md:grid-cols-2">
            {ci.new_experiences.length > 0 && (
              <div>
                <h3 className="mb-1 font-bold">سوابق استخراج‌شده</h3>
                <ul className="list-disc pr-5 text-[#CFC9F5]">
                  {ci.new_experiences.map((e, i) => (
                    <li key={i}>{[e.title, e.company].filter(Boolean).join(' — ')}</li>
                  ))}
                </ul>
              </div>
            )}
            {ci.new_goals.length > 0 && (
              <div>
                <h3 className="mb-1 font-bold">اهداف شغلی</h3>
                <ul className="list-disc pr-5 text-[#CFC9F5]">
                  {ci.new_goals.map((g, i) => (
                    <li key={i}>{[g.role, g.industry].filter(Boolean).join(' — ')}</li>
                  ))}
                </ul>
              </div>
            )}
            {ci.new_constraints.length > 0 && (
              <div>
                <h3 className="mb-1 font-bold">محدودیت‌ها</h3>
                <ul className="list-disc pr-5 text-[#CFC9F5]">
                  {ci.new_constraints.map((c, i) => (
                    <li key={i}>
                      {c.category}: {c.value}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {ci.clarification_questions.length > 0 && (
            <NoteBox>
              برای دقیق‌تر شدن: {ci.clarification_questions.join(' ؛ ')}
            </NoteBox>
          )}
        </Panel>
      )}

      {hidden.length > 0 && (
        <Panel title="مهارت‌های پنهان — منتظر تأیید تو">
          <p className="text-sm leading-7 text-[#A9A4D0]">
            این مهارت‌ها از توضیح پروژه‌ها و سوابقت حدس زده شده‌اند و تا وقتی تأیید نکنی در Career Memory یا رزومه نمی‌آیند. این
            فهرست فقط تا بستن صفحه می‌ماند.
          </p>
          <ul className="space-y-3">
            {hidden.map((skill) => (
              <li key={skill.name} className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{skill.name}</span>
                  <span className="flex gap-2">
                    <PrimaryButton disabled={working === skill.name} onClick={() => decideHidden(skill, true)}>
                      این مهارت را دارم
                    </PrimaryButton>
                    <GhostButton disabled={working === skill.name} onClick={() => decideHidden(skill, false)}>
                      ندارم
                    </GhostButton>
                  </span>
                </div>
                {skill.evidence?.filter((e) => e.quote).map((e, i) => (
                  <p key={i} className="text-xs text-[#A9A4D0]">
                    شاهد از متن تو: «{e.quote}»
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="حافظهٔ شغلی من">
        {!memory ? (
          <p className="text-sm text-[#A9A4D0]">در حال بارگذاری…</p>
        ) : memory.skills.length + memory.experiences.length + memory.projects.length === 0 ? (
          <p className="text-sm text-[#A9A4D0]">هنوز چیزی ثبت نشده. بالا دربارهٔ خودت بنویس.</p>
        ) : (
          <div className="space-y-5 text-sm">
            {pending.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold">مهارت‌های منتظر تأیید</h3>
                <ul className="space-y-2">
                  {pending.map((s) => (
                    <li key={s.name} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                      <span>
                        {s.name} <Chip tone="warn">{STATUS_LABEL[s.status]}</Chip>
                      </span>
                      <span className="flex gap-2">
                        <PrimaryButton disabled={working === s.name} onClick={() => decide(s.name, 'confirm')}>
                          تأیید
                        </PrimaryButton>
                        <GhostButton disabled={working === s.name} onClick={() => decide(s.name, 'reject')}>
                          رد
                        </GhostButton>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {confirmed.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold">مهارت‌های تأییدشده</h3>
                <div className="flex flex-wrap gap-2">
                  {confirmed.map((s) => (
                    <Chip key={s.name} tone="ok">
                      {s.name}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            {rejected.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold">مهارت‌های ردشده</h3>
                <div className="flex flex-wrap gap-2">
                  {rejected.map((s) => (
                    <Chip key={s.name} tone="bad">
                      {s.name}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            {memory.experiences.length > 0 && (
              <div>
                <h3 className="mb-1 font-bold">سوابق</h3>
                <ul className="list-disc pr-5 text-[#CFC9F5]">
                  {memory.experiences.map((e, i) => (
                    <li key={i}>{[e.title, e.company].filter(Boolean).join(' — ')}</li>
                  ))}
                </ul>
              </div>
            )}
            {memory.projects.length > 0 && (
              <div>
                <h3 className="mb-1 font-bold">پروژه‌ها</h3>
                <ul className="list-disc pr-5 text-[#CFC9F5]">
                  {memory.projects.map((p, i) => (
                    <li key={i}>{p.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Panel>
    </AgentShell>
  );
}
