'use client';

import { useEffect, useState } from 'react';
import {
  MATCH_LABELS,
  fetchGapPriority,
  simulateWhatIf,
  type GapItem,
  type WhatIfResult,
} from '@/lib/agents-api';
import {
  AgentShell,
  Chip,
  ErrorBox,
  GhostButton,
  Panel,
  PrimaryButton,
  errorMessage,
  inputClass,
} from '@/components/agents/AgentShell';

const split = (value: string) =>
  value
    .split(/[,،\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

export default function WhatIfPage() {
  const [skills, setSkills] = useState('');
  const [languages, setLanguages] = useState('');
  const [certs, setCerts] = useState('');
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [gaps, setGaps] = useState<GapItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGapPriority()
      .then((r) => setGaps(r.prioritized_gaps))
      .catch(() => setGaps([]));
  }, []);

  function addSkill(name: string) {
    setSkills((current) => (split(current).includes(name) ? current : [...split(current), name].join('، ')));
  }

  async function simulate() {
    const hypothetical = { skills: split(skills), languages: split(languages), certifications: split(certs) };
    if (!hypothetical.skills.length && !hypothetical.languages.length && !hypothetical.certifications.length) {
      setError('حداقل یک مهارت، زبان یا گواهینامه وارد کن.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await simulateWhatIf(hypothetical));
    } catch (cause) {
      setError(errorMessage(cause, 'شبیه‌سازی ناموفق بود.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AgentShell
      title="شبیه‌ساز مهارت (What-if)"
      subtitle="ببین اگر مهارت یا گواهینامه‌ای را یاد بگیری، تناسبت با آگهی‌های فیدت چطور عوض می‌شود. این فقط یک شبیه‌سازی است و چیزی در حافظهٔ شغلی یا رزومه‌ات ثبت نمی‌شود."
    >
      <Panel title="اگر این‌ها را داشتم…">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">
            مهارت‌ها
            <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="SQL، Docker" className={inputClass} />
          </label>
          <label className="grid gap-1 text-sm">
            زبان‌ها
            <input value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English" className={inputClass} />
          </label>
          <label className="grid gap-1 text-sm">
            گواهینامه‌ها
            <input value={certs} onChange={(e) => setCerts(e.target.value)} placeholder="AWS Certified" className={inputClass} />
          </label>
        </div>
        <p className="text-xs text-[#A9A4D0]">با ویرگول یا خط جدید جدا کن.</p>
        <ErrorBox message={error} />
        <PrimaryButton onClick={simulate} disabled={busy}>
          {busy ? 'در حال شبیه‌سازی…' : 'شبیه‌سازی کن'}
        </PrimaryButton>
      </Panel>

      {result && (
        <Panel title="نتیجه">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-[#A9A4D0]">
                <tr>
                  <th className="p-2">وضعیت تناسب</th>
                  <th className="p-2">قبل</th>
                  <th className="p-2">بعد</th>
                  <th className="p-2">تغییر</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(result.before_count).map((key) => {
                  const delta = result.delta[key] ?? 0;
                  return (
                    <tr key={key} className="border-t border-white/10">
                      <td className="p-2">{MATCH_LABELS[key] ?? key}</td>
                      <td className="p-2">{result.before_count[key]}</td>
                      <td className="p-2">{result.after_count[key]}</td>
                      <td className={`p-2 font-bold ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-red-300' : ''}`}>
                        {delta > 0 ? `+${delta}` : delta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3 className="font-bold">آگهی‌هایی که بهتر می‌شوند ({result.upgraded_jobs.length})</h3>
          {result.upgraded_jobs.length === 0 ? (
            <p className="text-sm text-[#A9A4D0]">با این مهارت‌ها وضعیت هیچ آگهی‌ای در فیدت بهتر نمی‌شود.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {result.upgraded_jobs.map((job, i) => (
                <li key={i} className="space-y-1 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {job.job_analysis.title?.value ?? 'آگهی'} — {job.job_analysis.company?.value ?? ''}
                    </span>
                    <span className="flex items-center gap-2">
                      <Chip>{MATCH_LABELS[job.previous_status] ?? job.previous_status}</Chip>
                      <span>←</span>
                      <Chip tone="ok">{MATCH_LABELS[job.new_status] ?? job.new_status}</Chip>
                    </span>
                  </div>
                  <p className="text-xs text-[#A9A4D0]">
                    امتیاز {job.previous_score} ← {job.new_score}. {job.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Panel title="کدام مهارت بیشترین تأثیر را دارد؟">
        {gaps === null ? (
          <p className="text-sm text-[#A9A4D0]">در حال بارگذاری…</p>
        ) : gaps.length === 0 ? (
          <p className="text-sm text-[#A9A4D0]">
            فعلاً شکاف مهارتی قابل‌اولویت‌بندی پیدا نشد (فید یا مهارت‌های تأییدشده کافی نیست).
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {gaps.slice(0, 10).map((gap) => (
              <li key={gap.skill} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <div>
                  <span className="font-bold">{gap.skill}</span>
                  <span className="mr-2 text-xs text-[#A9A4D0]">
                    {gap.jobs_unlocked} آگهی را باز می‌کند · تأثیر {gap.impact_score}٪
                  </span>
                  {gap.sample_job_titles.length > 0 && (
                    <p className="text-xs text-[#A9A4D0]">مثلاً: {gap.sample_job_titles.slice(0, 3).join('، ')}</p>
                  )}
                </div>
                <GhostButton onClick={() => addSkill(gap.skill)}>اضافه به شبیه‌سازی</GhostButton>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AgentShell>
  );
}
