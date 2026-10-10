'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listResumes, type ResumeSummary } from '@/lib/api';
import { validateEvidence, type EvidenceReport } from '@/lib/agents-api';
import {
  AgentShell,
  ErrorBox,
  Panel,
  PrimaryButton,
  errorMessage,
  inputClass,
} from '@/components/agents/AgentShell';
import { EvidenceReportView } from '@/components/agents/EvidenceReportView';

type Source = 'resume' | 'text';

export default function EvidenceValidatorPage() {
  const [source, setSource] = useState<Source>('resume');
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [resumeId, setResumeId] = useState('');
  const [text, setText] = useState('');
  const [report, setReport] = useState<EvidenceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listResumes()
      .then((list) => {
        setResumes(list);
        const active = list.find((r) => r.active) ?? list[0];
        if (active) setResumeId(String(active.id));
        else setSource('text');
      })
      .catch((cause) => setError(errorMessage(cause, 'بارگذاری رزومه‌ها ناموفق بود.')))
      .finally(() => setLoading(false));
  }, []);

  async function run() {
    setBusy(true);
    setError('');
    setReport(null);
    try {
      if (source === 'resume') {
        if (!resumeId) throw new Error('یک رزومه انتخاب کن.');
        setReport(await validateEvidence({ resume_id: Number(resumeId) }));
      } else {
        if (!text.trim()) throw new Error('متنی برای بررسی وارد کن.');
        setReport(await validateEvidence({ text }));
      }
    } catch (cause) {
      setError(errorMessage(cause, 'اعتبارسنجی ناموفق بود.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AgentShell
      title="اعتبارسنج شواهد"
      subtitle="هر ادعای رزومه (مهارت، سابقه، تحصیلات، پروژه و عددها) با «حافظهٔ شغلی» تو مقایسه می‌شود. بدون شاهد = بدون انتشار. این ایجنت قطعی است و از هوش مصنوعی برای تأیید استفاده نمی‌کند."
    >
      <Panel title="چه چیزی بررسی شود؟">
        <div className="flex flex-wrap gap-2" role="tablist">
          {(
            [
              ['resume', 'رزومهٔ ذخیره‌شده'],
              ['text', 'متن آزاد'],
            ] as [Source, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={source === value}
              onClick={() => setSource(value)}
              className={`rounded-full border px-4 py-1.5 text-sm ${
                source === value ? 'border-violet-300/60 bg-violet-500/30' : 'border-white/15 bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {source === 'resume' ? (
          loading ? (
            <p className="text-sm text-[#A9A4D0]">در حال بارگذاری…</p>
          ) : resumes.length === 0 ? (
            <p className="text-sm text-[#A9A4D0]">
              هنوز رزومه‌ای نداری. از{' '}
              <Link href="/resume-writer" className="underline">
                نویسندهٔ رزومه
              </Link>{' '}
              یا{' '}
              <Link href="/resume-wizard" className="underline">
                ساخت رزومه
              </Link>{' '}
              شروع کن، یا «متن آزاد» را انتخاب کن.
            </p>
          ) : (
            <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} className={inputClass}>
              {resumes.map((r) => (
                <option key={r.id} value={r.id} className="text-black">
                  {r.title} — نسخهٔ {r.version}
                  {r.active ? ' (فعال)' : ''}
                </option>
              ))}
            </select>
          )
        ) : (
          <textarea
            rows={6}
            maxLength={20000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="مثلاً: «با تیم ۵ نفره، سرعت سیستم را ۳۷٪ بهبود دادم»"
            className={inputClass}
          />
        )}

        <ErrorBox message={error} />
        <PrimaryButton onClick={run} disabled={busy || (source === 'resume' && !resumeId)}>
          {busy ? 'در حال بررسی…' : 'اعتبارسنجی کن'}
        </PrimaryButton>
      </Panel>

      {report && (
        <Panel title={report.resume_title ? `نتیجه: ${report.resume_title}` : 'نتیجه'}>
          <EvidenceReportView report={report} />
          {!report.can_publish && (
            <p className="text-sm text-[#A9A4D0]">
              برای برطرف‌کردن موارد «نیازمند تأیید» یا «بدون شاهد»، سوابقت را در{' '}
              <Link href="/career" className="underline">
                تحلیل سوابق
              </Link>{' '}
              ثبت و تأیید کن.
            </p>
          )}
        </Panel>
      )}
    </AgentShell>
  );
}
