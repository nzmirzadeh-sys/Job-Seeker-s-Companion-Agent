/**
 * API لایهٔ ایجنت‌های تخصصی (Resume Writer, Evidence Validator, Career Intelligence, What-if)
 * از `fetchAPI` مشترک استفاده می‌کند تا توکن و مدیریت خطا یکسان بماند.
 */
import { fetchAPI, type ResumeContent, type ResumeDetail } from '@/lib/api';

// ── Evidence Validator ───────────────────────────────
export type EvidenceStatus = 'verified' | 'needs_clarification' | 'unsupported' | 'contradicted';

export interface EvidenceClaim {
  id: number;
  section: string;
  claim_text: string;
  claim_type: string;
  status: EvidenceStatus;
  evidence_ref: Record<string, unknown> | null;
  suggestion: string | null;
  context: string;
}

export interface EvidenceReport {
  claims: EvidenceClaim[];
  summary: Record<EvidenceStatus, number> & { total: number };
  overall_score: number;
  can_publish: boolean;
  source?: 'resume_id' | 'content' | 'text';
  resume_id?: number;
  resume_title?: string;
}

export function validateEvidence(
  body: { resume_id: number } | { content: ResumeContent } | { text: string }
): Promise<EvidenceReport> {
  return fetchAPI<EvidenceReport>('/evidence/validate/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── Resume Writer ────────────────────────────────────
export interface ExcludedSkill {
  name: string;
  reason: EvidenceStatus;
  message: string;
}

export interface ResumeWriterRequest {
  job_id?: number;
  job_description?: string;
  job_title?: string;
  resume_id?: number;
  polish?: boolean;
  save?: boolean;
  title?: string;
}

export interface ResumeWriterResult {
  mode: 'generate' | 'improve';
  content: ResumeContent;
  title: string;
  job: { title: string; company: string } | null;
  excluded_skills: ExcludedSkill[];
  llm_used: boolean;
  rejected_rewrites: { field: string; reason: string }[];
  warnings: string[];
  validation: EvidenceReport;
  resume?: ResumeDetail;
}

export function writeResume(body: ResumeWriterRequest): Promise<ResumeWriterResult> {
  return fetchAPI<ResumeWriterResult>('/resume-writer/generate/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── Career Intelligence ──────────────────────────────
export interface CareerEvidence {
  source: string;
  quote?: string | null;
  confidence?: string;
}

export interface CareerCandidateSkill {
  name: string;
  category?: string;
  level?: string;
  years_of_experience?: number | null;
  evidence?: CareerEvidence[];
}

export interface HiddenSkillSuggestion extends CareerCandidateSkill {
  status: 'pending_confirmation';
  source: string;
}

export interface CareerAnalysis {
  career_intelligence: {
    reply: string;
    new_skills: CareerCandidateSkill[];
    new_experiences: { title: string; company?: string | null; years?: number | null; description?: string | null }[];
    new_goals: { role: string; industry?: string | null }[];
    new_preferences: { category: string; value: string }[];
    new_constraints: { category: string; value: string; hard?: boolean }[];
    clarification_questions: string[];
  };
  persisted: {
    changed: string[];
    clarification_questions: string[];
    hidden_skills: HiddenSkillSuggestion[];
  };
}

export function analyzeCareer(message: string): Promise<CareerAnalysis> {
  return fetchAPI<CareerAnalysis>('/career/analyze/', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export interface MemorySkill {
  name: string;
  category?: string | null;
  level?: string;
  years_of_experience?: number | null;
  status: 'unverified' | 'needs_clarification' | 'confirmed' | 'rejected' | 'pending_confirmation';
}

export interface MemorySnapshot {
  skills: MemorySkill[];
  experiences: { title: string; company?: string | null; years?: number | null; description?: string | null }[];
  projects: { name: string; role?: string | null; description?: string | null }[];
  education: { degree: string; field?: string | null; school?: string | null; graduation_year?: number | null }[];
  goals: { role: string; industry?: string | null }[];
}

export function fetchMemory(): Promise<MemorySnapshot> {
  return fetchAPI<MemorySnapshot>('/career/memory/');
}

export function decideSkill(name: string, action: 'confirm' | 'reject') {
  return fetchAPI<{ status: string }>('/career/skills/', {
    method: 'POST',
    body: JSON.stringify({ name, action }),
  });
}

/**
 * پذیرش مهارت پنهان: ابتدا مسیر اختصاصی مهارت را به Memory اضافه می‌کند و بعد، چون کاربر
 * صراحتاً پذیرفته، وضعیتش را «confirmed» می‌کند (add_skill به‌تنهایی «unverified» می‌گذارد).
 */
export async function acceptHiddenSkill(name: string) {
  await fetchAPI('/career/hidden-skill/confirm/', {
    method: 'POST',
    body: JSON.stringify({ skill_name: name, accept: true }),
  });
  return decideSkill(name, 'confirm');
}

export function rejectHiddenSkill(name: string) {
  return fetchAPI('/career/hidden-skill/confirm/', {
    method: 'POST',
    body: JSON.stringify({ skill_name: name, accept: false }),
  });
}

// ── What-if ──────────────────────────────────────────
export interface WhatIfResult {
  before_count: Record<string, number>;
  after_count: Record<string, number>;
  delta: Record<string, number>;
  upgraded_jobs: {
    job_analysis: { title?: { value?: string }; company?: { value?: string } };
    previous_status: string;
    new_status: string;
    previous_score: number;
    new_score: number;
    reason: string;
  }[];
}

export function simulateWhatIf(hypothetical: {
  skills?: string[];
  languages?: string[];
  certifications?: string[];
}): Promise<WhatIfResult> {
  return fetchAPI<WhatIfResult>('/career/what-if/', {
    method: 'POST',
    body: JSON.stringify({ hypothetical }),
  });
}

export interface GapItem {
  skill: string;
  jobs_unlocked: number;
  jobs_mentioning: number;
  score_gain: number;
  impact_score: number;
  sample_job_titles: string[];
}

export function fetchGapPriority(): Promise<{ prioritized_gaps: GapItem[] }> {
  return fetchAPI<{ prioritized_gaps: GapItem[] }>('/career/gap-priority/');
}

export const MATCH_LABELS: Record<string, string> = {
  strong_match: 'تناسب قوی',
  good_match: 'تناسب خوب',
  partial_match: 'تناسب نسبی',
  weak_match: 'تناسب ضعیف',
  not_recommended: 'پیشنهاد نمی‌شود',
  needs_more_information: 'نیازمند اطلاعات بیشتر',
};
