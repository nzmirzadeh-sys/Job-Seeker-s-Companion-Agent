'use client';

import type { EvidenceReport, EvidenceStatus } from '@/lib/agents-api';
import { Chip } from './AgentShell';

export const STATUS_LABEL: Record<EvidenceStatus, string> = {
  verified: 'تأییدشده',
  needs_clarification: 'نیازمند تأیید',
  unsupported: 'بدون شاهد',
  contradicted: 'متناقض',
};

const STATUS_TONE: Record<EvidenceStatus, 'ok' | 'warn' | 'bad'> = {
  verified: 'ok',
  needs_clarification: 'warn',
  unsupported: 'bad',
  contradicted: 'bad',
};

const SECTION_LABEL: Record<string, string> = {
  summary: 'خلاصه',
  skills: 'مهارت‌ها',
  experiences: 'سوابق کاری',
  projects: 'پروژه‌ها',
  educations: 'تحصیلات',
  text: 'متن',
};

export function EvidenceReportView({ report }: { report: EvidenceReport }) {
  const { summary } = report;
  return (
    <div className="space-y-4">
      <div
        role="status"
        className={`rounded-xl border p-3 text-sm leading-7 ${
          report.can_publish
            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
            : 'border-red-400/40 bg-red-400/10 text-red-100'
        }`}
      >
        {summary.total === 0
          ? 'ادعای قابل‌بررسی‌ای پیدا نشد.'
          : report.can_publish
            ? 'ادعای بدون شاهد یا متناقضی پیدا نشد؛ رزومه از نظر شواهد قابل انتشار است.'
            : 'ادعای بدون شاهد یا متناقض وجود دارد. قبل از ارسال رزومه آن‌ها را برطرف کن.'}
        {summary.total > 0 && (
          <span className="mr-2 font-bold">امتیاز شواهد: {Math.round(report.overall_score * 100)}٪</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABEL) as EvidenceStatus[]).map((status) => (
          <Chip key={status} tone={STATUS_TONE[status]}>
            {STATUS_LABEL[status]}: {summary[status]}
          </Chip>
        ))}
      </div>

      {report.claims.length > 0 && (
        <ul className="space-y-2">
          {report.claims.map((claim) => (
            <li key={claim.id} className="space-y-1 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{claim.claim_text}</span>
                <span className="flex items-center gap-2">
                  <Chip>{SECTION_LABEL[claim.section] ?? claim.section}</Chip>
                  <Chip tone={STATUS_TONE[claim.status]}>{STATUS_LABEL[claim.status]}</Chip>
                </span>
              </div>
              {claim.context && <p className="text-xs text-[#A9A4D0]">در: {claim.context}</p>}
              {claim.suggestion && <p className="text-xs leading-6 text-amber-100">{claim.suggestion}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
