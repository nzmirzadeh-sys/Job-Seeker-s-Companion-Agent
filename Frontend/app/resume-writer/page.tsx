'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  api,
  createResume,
  listResumes,
  resumePdfUrl,
  type MatchRow,
  type PaginatedResponse,
  type ResumeDetail,
  type ResumeSummary,
} from '@/lib/api';
import { writeResume, type ResumeWriterResult } from '@/lib/agents-api';
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
import { EvidenceReportView, STATUS_LABEL } from '@/components/agents/EvidenceReportView';

type Base = 'memory' | 'improve';
type Target = 'none' | 'feed' | 'text';

export default function ResumeWriterPage() {
  const [base, setBase] = useState<Base>('memory');
  const [target, setTarget] = useState<Target>('none');
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [jobs, setJobs] = useState<MatchRow[]>([]);
  const [resumeId, setResumeId] = useState('');
  const [jobId, setJobId] = useState('');
  const [jobText, setJobText] = useState('');
  const [polish, setPolish] = useState(true);
  const [result, setResult] = useState<ResumeWriterResult | null>(null);
  const [saved, setSaved] = useState<ResumeDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listResumes()
      .then((list) => {
        setResumes(list);
        const active = list.find((r) => r.active) ?? list[0];
        if (active) setResumeId(String(active.id));
      })
      .catch(() => undefined);
    api<PaginatedResponse<MatchRow>>('/jobs/feed/?limit=50')
      .then((page) => setJobs(page.results))
      .catch(() => undefined);
  }, []);

  async function run() {
    setBusy(true);
    setError('');
    setResult(null);
    setSaved(null);
    try {
      const body: Parameters<typeof writeResume>[0] = { polish };
      if (base === 'improve') {
        if (!resumeId) throw new Error('یک رزومه برای بهبود انتخاب کن.');
        body.resume_id = Number(resumeId);
      }
      if (target === 'feed') {
        if (!jobId) throw new Error('یک آگهی انتخاب کن.');
        body.job_id = Number(jobId);
      } else if (target === 'text') {
        if (jobText.trim().length < 40) throw new Error('متن آگهی حداقل ۴۰ نویسه باشد.');
        body.job_description = jobText;
      }
      setResult(await writeResume(body));
    } catch (cause) {
      setError(errorMessage(cause, 'نوشتن رزومه ناموفق بود.'));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!result) return;
    setBusy(true);
    setError('');
    try {
      setSaved(await createResume({ title: result.title, content: result.content }));
    } catch (cause) {
      setError(errorMessage(cause, 'ذخیرهٔ رزومه ناموفق بود.'));
    } finally {
      setBusy(false);
    }
  }

  const c = result?.content;

  return (
    <AgentShell
      title="نویسندهٔ رزومه"
      subtitle="رزومه فقط از اطلاعات تأییدشدهٔ «حافظهٔ شغلی» نوشته می‌شود. مهارت تأییدنشده یا ردشده وارد رزومه نمی‌شود و بازنویسی هوشمند هم حق ندارد عدد یا ادعای جدید اضافه کند."
    >
      <Panel title="تنظیمات">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            شروع از
            <select value={base} onChange={(e) => setBase(e.target.value as Base)} className={inputClass}>
              <option value="memory" className="text-black">
                صفر — از حافظهٔ شغلی من
              </option>
              <option value="improve" className="text-black">
                بهبود یکی از رزومه‌های موجود
              </option>
            </select>
          </label>
          {base === 'improve' && (
            <label className="grid gap-2 text-sm">
              رزومه
              <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} className={inputClass}>
                {resumes.length === 0 && (
                  <option value="" className="text-black">
                    رزومه‌ای وجود ندارد
                  </option>
                )}
                {resumes.map((r) => (
                  <option key={r.id} value={r.id} className="text-black">
                    {r.title} — نسخهٔ {r.version}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="grid gap-2 text-sm">
            هدف‌گذاری برای آگهی
            <select value={target} onChange={(e) => setTarget(e.target.value as Target)} className={inputClass}>
              <option value="none" className="text-black">
                بدون آگهی مشخص
              </option>
              <option value="feed" className="text-black">
                آگهی از فید من
              </option>
              <option value="text" className="text-black">
                متن آگهی را می‌چسبانم
              </option>
            </select>
          </label>
          {target === 'feed' && (
            <label className="grid gap-2 text-sm">
              آگهی
              <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={inputClass}>
                <option value="" className="text-black">
                  انتخاب آگهی
                </option>
                {jobs.map(({ job }) => (
                  <option key={job.id} value={job.id} className="text-black">
                    {job.title} — {job.company}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {target === 'text' && (
          <textarea
            rows={5}
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="متن آگهی شغلی…"
            className={inputClass}
          />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={polish} onChange={(e) => setPolish(e.target.checked)} />
          بازنویسی هوشمند متن‌ها (در صورت فعال‌بودن سرویس هوش مصنوعی)
        </label>
        <ErrorBox message={error} />
        <PrimaryButton onClick={run} disabled={busy}>
          {busy && !result ? 'در حال نوشتن…' : 'رزومه را بنویس'}
        </PrimaryButton>
      </Panel>

      {result && c && (
        <>
          {result.warnings.map((w) => (
            <NoteBox key={w}>{w}</NoteBox>
          ))}

          <Panel
            title={result.title}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Chip>{result.mode === 'improve' ? 'بهبود رزومهٔ موجود' : 'نوشته‌شده از حافظهٔ شغلی'}</Chip>
                <Chip tone={result.llm_used ? 'ok' : 'neutral'}>
                  {result.llm_used ? 'با بازنویسی هوشمند' : 'بدون بازنویسی هوشمند'}
                </Chip>
              </div>
            }
          >
            <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-7">
              <div>
                <p className="text-lg font-bold">{c.full_name || 'نام ثبت نشده'}</p>
                <p className="text-[#C4B5FD]">{c.headline}</p>
                <p className="text-xs text-[#A9A4D0]">{[c.email, c.phone, c.city].filter(Boolean).join(' · ')}</p>
              </div>
              {c.summary && <p>{c.summary}</p>}
              {!!c.skills?.length && (
                <div className="flex flex-wrap gap-2">
                  {c.skills.map((s) => (
                    <Chip key={s.name} tone="ok">
                      {s.name}
                    </Chip>
                  ))}
                </div>
              )}
              {!!c.experiences?.length && (
                <div>
                  <h3 className="font-bold">سوابق کاری</h3>
                  <ul className="list-disc pr-5">
                    {c.experiences.map((e, i) => (
                      <li key={i}>
                        {[e.title, e.company].filter(Boolean).join(' — ')}
                        {e.description ? `: ${e.description}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!!c.projects?.length && (
                <div>
                  <h3 className="font-bold">پروژه‌ها</h3>
                  <ul className="list-disc pr-5">
                    {c.projects.map((p, i) => (
                      <li key={i}>
                        {p.name}
                        {p.description ? `: ${p.description}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!!c.educations?.length && (
                <div>
                  <h3 className="font-bold">تحصیلات</h3>
                  <ul className="list-disc pr-5">
                    {c.educations.map((e, i) => (
                      <li key={i}>{[e.degree, e.school, e.end].filter(Boolean).join(' — ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {saved ? (
              <div className="flex flex-wrap items-center gap-3 text-sm text-emerald-200">
                <span>به‌عنوان نسخهٔ {saved.version} ذخیره شد و فعال است.</span>
                <a href={resumePdfUrl(saved.id)} className="underline">
                  دانلود PDF
                </a>
                <Link href="/evidence-validator" className="underline">
                  اعتبارسنجی دوباره
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <PrimaryButton onClick={save} disabled={busy}>
                  ذخیره به‌عنوان نسخهٔ جدید
                </PrimaryButton>
                <GhostButton onClick={run} disabled={busy}>
                  دوباره بنویس
                </GhostButton>
              </div>
            )}
          </Panel>

          {result.excluded_skills.length > 0 && (
            <Panel title="مهارت‌هایی که وارد رزومه نشدند">
              <ul className="space-y-2 text-sm">
                {result.excluded_skills.map((s) => (
                  <li key={s.name} className="flex flex-wrap items-center gap-2">
                    <Chip tone={s.reason === 'needs_clarification' ? 'warn' : 'bad'}>
                      {s.name} — {STATUS_LABEL[s.reason]}
                    </Chip>
                    <span className="text-[#A9A4D0]">{s.message}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-[#A9A4D0]">
                برای وارد‌کردن این‌ها، اول در{' '}
                <Link href="/career" className="underline">
                  تحلیل سوابق
                </Link>{' '}
                تأییدشان کن.
              </p>
            </Panel>
          )}

          {result.rejected_rewrites.length > 0 && (
            <NoteBox>
              {result.rejected_rewrites.length} بازنویسی هوشمند چون ادعای جدید (عدد یا مهارت بدون شاهد) داشت رد شد و متن
              اصلی ماند.
            </NoteBox>
          )}

          <Panel title="گزارش شواهد این رزومه">
            <EvidenceReportView report={result.validation} />
          </Panel>
        </>
      )}
    </AgentShell>
  );
}
