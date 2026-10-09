/**
 * API Layer - لایهٔ یکپارچه برای تمام فراخوانی‌های API
 * بر اساس شکل واقعی endpoint های Backend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

// ═════════════════════════════════════════════════════
// TYPES — مطابق مدل واقعی Pydantic در Backend
// ═════════════════════════════════════════════════════

// ── Shared / Common ──────────────────────────────────
export interface Profile {
  completed: boolean;
}
export type FitStatus = 'match' | 'partial' | 'conflict' | 'unknown' | 'not_applicable';
export type Decision =
  | 'strong_match'
  | 'good_match'
  | 'partial_match'
  | 'weak_match'
  | 'not_recommended'
  | 'needs_more_information';
export type SkillMatchStatus = 'confirmed_match' | 'uncertain_match' | 'missing' | 'rejected';
export type ConstraintStatus = 'satisfied' | 'violated' | 'unknown' | 'not_applicable';
export type TruthClaimStatus = 'verified' | 'unsupported' | 'needs_clarification';

export interface FitDimension {
  score: number;
  max_score: number;
  status: FitStatus;
  explanation: string;
}

export interface SkillMatchDetail {
  skill: string;
  importance: 'required' | 'preferred';
  status: SkillMatchStatus;
  user_status?: string | null;
  evidence: Array<Record<string, unknown>>;
  explanation: string;
}

export interface ConstraintEvaluation {
  category: string;
  value: string;
  hard: boolean;
  status: ConstraintStatus;
  explanation: string;
  evidence: Array<Record<string, unknown>>;
}

// ── Match ────────────────────────────────────────────
export interface MatchDecisionResult {
  overall_decision: Decision;
  overall_score: number;
  technical_fit: FitDimension;
  experience_fit: FitDimension;
  education_fit: FitDimension;
  career_goal_fit: FitDimension;
  preference_fit: FitDimension;
  constraint_fit: FitDimension;
  skill_matches: SkillMatchDetail[];
  matching_skills: string[];
  missing_required_skills: string[];
  missing_preferred_skills: string[];
  uncertain_matches: string[];
  strengths: string[];
  gaps: string[];
  risks: string[];
  constraints: ConstraintEvaluation[];
  reasoning: string;
  recommendation: string;
  methodology_version?: string;
  llm_explanation_used?: boolean;
  warnings?: string[];
}

export interface AnalyzeMatchResponse {
  match_result: MatchDecisionResult;
  job_source: 'provided' | 'analyzed' | 'job_posting';
}

export interface JobAnalysisPayload {
  title?: { value: string } | string;
  company?: { value: string } | string;
  required_skills?: unknown[];
  preferred_skills?: unknown[];
  [k: string]: unknown;
}

export interface MatchRowJob {
  id: number | string;
  title: string;
  company: string;
  city?: string;
  level?: string;
  description?: string;
  job_types?: string[];
}

export interface MatchRow {
  job: MatchRowJob;
  score: number;
  reasons?: string[];
  missing_skills?: string[];
  breakdown?: {
    skills: number;
    role: number;
    level: number;
    logistics: number;
  };
}

// ── Resume ───────────────────────────────────────────
export interface ResumeSummary {
  id: number;
  version: number;
  title: string;
  active: boolean;
  updated_at: string;
}

export interface ResumeDetail extends ResumeSummary {
  content: ResumeContent;
  created_at: string;
}

export interface ResumeContent {
  full_name?: string;
  headline?: string;
  email?: string;
  phone?: string;
  city?: string;
  summary?: string;
  skills?: { name: string }[];
  experiences?: {
    title?: string;
    company?: string;
    start?: string;
    end?: string;
    description?: string;
  }[];
  projects?: {
    name?: string;
    description?: string;
    link?: string;
  }[];
  educations?: {
    degree?: string;
    school?: string;
    start?: string;
    end?: string;
  }[];
  languages?: { name: string; level: string }[];
  links?: string[];
}

export interface TruthClaimItem {
  claim_text: string;
  claim_type: 'percentage' | 'quantitative';
  status: TruthClaimStatus;
  evidence_ref: {
    type: 'skill' | 'experience' | 'project';
    skill_name?: string;
    evidence?: unknown;
    title?: string;
    company?: string;
    name?: string;
  } | null;
  suggestion?: string;
  context?: string;
}

export interface TruthReportResponse {
  resume_id: number;
  truth_report: TruthClaimItem[];
  overall_truth_score: number; // 0..1
  verified_claims: number;
  unsupported_claims: number;
  needs_clarification_claims: number;
}

// Backward-compat alias
export type TruthReport = TruthReportResponse;

// ── Career / Gap Priority ────────────────────────────
export interface PrioritizedGap {
  skill: string;
  jobs_unlocked: number;
  jobs_mentioning: number;
  score_gain: number;
  impact_score: number; // 0..100
  sample_job_titles: string[];
  sample_jobs: Array<{
    title: string;
    company: string;
    current_status: Decision | string;
    new_status: Decision | string;
    job_analysis: JobAnalysisPayload;
  }>;
}

export interface GapPriorityResponse {
  prioritized_gaps: PrioritizedGap[];
}

export interface CareerMemorySkill {
  name: string;
  category?: string;
  status: 'confirmed' | 'unverified' | 'needs_clarification' | 'rejected';
  level?: string;
  years_of_experience?: number;
  evidence?: unknown[];
}

export interface CareerMemoryExperience {
  title?: string;
  company?: string;
  description?: string;
  start?: string;
  end?: string;
}

export interface CareerMemorySnapshot {
  skills: CareerMemorySkill[];
  experiences: CareerMemoryExperience[];
  projects: Array<{ name?: string; description?: string }>;
  verified_skills?: CareerMemorySkill[];
  skills_needing_clarification?: CareerMemorySkill[];
  [k: string]: unknown;
}

// ── Chat (skeleton for compat) ───────────────────────
export interface ChatEvent {
  type: 'assistant' | 'tool_use' | 'error' | 'done';
  text?: string;
  tool?: string;
  [k: string]: unknown;
}

export type ChatStreamListener = (event: ChatEvent) => void;

// ── Interview endpoints (legacy preserved) ───────────
export interface InterviewStartRequest {
  job_id: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface InterviewStartResponse {
  interview_id: string;
  questions: Array<{
    index: number;
    question: string;
    type: 'short' | 'long';
  }>;
}

export interface InterviewAnswerRequest {
  interview_id: string;
  question_index: number;
  answer: string;
}

export interface InterviewAnswerResponse {
  feedback: string;
  score: number;
  next_question?: string;
  completed: boolean;
}

export interface WhatIfRequest {
  hypothetical?: {
    skills?: string[];
    languages?: string[];
    certifications?: string[];
  };
}

export interface WhatIfResponse {
  before_count: Record<string, number>;
  after_count: Record<string, number>;
  delta: Record<string, number>;
  upgraded_jobs: unknown[];
}

export interface HiddenSkillConfirmRequest {
  skill_name: string;
  accept?: boolean;
}

export interface HiddenSkillConfirmResponse {
  status: 'confirmed' | 'rejected';
  skill?: unknown;
}

// ═════════════════════════════════════════════════════
// HELPERS — توابع کمکی عمومی
// ═════════════════════════════════════════════════════

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('auth_token', token);
  } catch {
    /* noop */
  }
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('auth_token');
  } catch {
    /* noop */
  }
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `API error: ${response.status}` }));
    const msg =
      (typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message?: string }).message
        : undefined) || `API error: ${response.status}`;
    throw new Error(msg as string);
  }

  return response.json();
}

// Alias برای سازگاری با import های موجود در صفحات
export const api = fetchAPI;

// ═════════════════════════════════════════════════════
// MATCH ENDPOINTS
// ═════════════════════════════════════════════════════

export async function analyzeMatch(params?: {
  job_analysis?: JobAnalysisPayload;
  description?: string;
  job_id?: number | string;
  explain_with_llm?: boolean;
}): Promise<AnalyzeMatchResponse> {
  if (USE_MOCKS) {
    return mockAnalyzeMatch();
  }
  return fetchAPI<AnalyzeMatchResponse>('/match/analyze/', {
    method: 'POST',
    body: JSON.stringify(params || {}),
  });
}

// ═════════════════════════════════════════════════════
// RESUME ENDPOINTS
// ═════════════════════════════════════════════════════

/** GET /api/resumes/ — لیست تمام رزومه‌های کاربر */
export async function listResumes(): Promise<ResumeSummary[]> {
  if (USE_MOCKS) {
    return mockListResumes();
  }
  return fetchAPI<ResumeSummary[]>('/resumes/');
}

/** POST /api/resumes/ — ساخت رزومهٔ جدید (به‌صورت اتوماتیک فعال می‌شود) */
export async function createResume(data?: {
  title?: string;
  content?: ResumeContent;
}): Promise<ResumeDetail> {
  if (USE_MOCKS) {
    return mockCreateResume(data);
  }
  return fetchAPI<ResumeDetail>('/resumes/', {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });
}

/** GET /api/resumes/<id>/ — جزئیات یک رزومه */
export async function getResume(id: number | string): Promise<ResumeDetail> {
  if (USE_MOCKS) {
    return mockGetResume(id);
  }
  return fetchAPI<ResumeDetail>(`/resumes/${id}/`);
}

/** PATCH /api/resumes/<id>/ — ویرایش جزئی رزومه */
export async function updateResume(
  id: number | string,
  patch: { title?: string; content?: ResumeContent; active?: boolean }
): Promise<ResumeDetail> {
  if (USE_MOCKS) {
    return mockUpdateResume(id, patch);
  }
  return fetchAPI<ResumeDetail>(`/resumes/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** GET /api/resumes/<id>/truth-report/ — گزارش حقیقت Feature C */
export async function getTruthReport(
  resumeId: number | string
): Promise<TruthReportResponse> {
  if (USE_MOCKS) {
    return mockGetTruthReport(resumeId);
  }
  return fetchAPI<TruthReportResponse>(`/resumes/${resumeId}/truth-report/`);
}

/** URL مستقیم برای دانلود PDF — به‌صورت `<a href>` قابل استفاده */
export function resumePdfUrl(resumeId: number | string): string {
  const url = `${API_BASE}/resumes/${resumeId}/pdf/`;
  const token = getToken();
  if (!token) return url;
  // Token در query گذاشته می‌شود چون هدر Authorization در لینک مستقیم کار نمی‌کند
  return `${url}?auth=${encodeURIComponent(token)}`;
}

// ═════════════════════════════════════════════════════
// CAREER ENDPOINTS
// ═════════════════════════════════════════════════════

export async function analyzeWhatIf(
  req: WhatIfRequest
): Promise<WhatIfResponse> {
  if (USE_MOCKS) {
    return mockAnalyzeWhatIf(req);
  }
  // endpoint واقعی shape {hypothetical: {...}} می‌گیرد نه added_skills
  const body = req.hypothetical
    ? req
    : { hypothetical: { skills: (req as unknown as { added_skills?: string[] }).added_skills || [] } };
  return fetchAPI<WhatIfResponse>('/career/what-if/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function confirmHiddenSkill(
  req: HiddenSkillConfirmRequest
): Promise<HiddenSkillConfirmResponse> {
  if (USE_MOCKS) {
    return mockConfirmHiddenSkill(req);
  }
  return fetchAPI<HiddenSkillConfirmResponse>('/career/hidden-skill/confirm/', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/** GET /api/career/gap-priority/ — تحلیل شکاف‌های مهارتی با اولویت‌بندی واقعی */
export async function getGapPriority(): Promise<GapPriorityResponse> {
  if (USE_MOCKS) {
    return mockGetGapPriority();
  }
  return fetchAPI<GapPriorityResponse>('/career/gap-priority/');
}

/** GET /api/career/memory/ — خواندن Snapshot کامل Career Memory */
export async function getCareerMemory(): Promise<CareerMemorySnapshot> {
  if (USE_MOCKS) {
    return mockGetCareerMemory();
  }
  return fetchAPI<CareerMemorySnapshot>('/career/memory/');
}

// ═════════════════════════════════════════════════════
// INTERVIEW ENDPOINTS
// ═════════════════════════════════════════════════════

export async function startInterview(
  req: InterviewStartRequest
): Promise<InterviewStartResponse> {
  if (USE_MOCKS) {
    return mockStartInterview(req);
  }
  return fetchAPI<InterviewStartResponse>('/interview/start/', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function answerInterviewQuestion(
  req: InterviewAnswerRequest
): Promise<InterviewAnswerResponse> {
  if (USE_MOCKS) {
    return mockAnswerInterviewQuestion(req);
  }
  return fetchAPI<InterviewAnswerResponse>('/interview/answer/', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// ═════════════════════════════════════════════════════
// CHAT STREAM (Skeleton — برای build شدن؛ در آینده کامل می‌شود)
// ═════════════════════════════════════════════════════

export async function streamChat(
  message: string,
  _scope: string,
  listener: ChatStreamListener
): Promise<void> {
  if (USE_MOCKS) {
    // پاسخ mock تکی
    listener({
      type: 'assistant',
      text: `[Mock] دریافت کردم: «${message}». در حال پردازش... اگر سوال فنی دارید بپرسید.`,
    });
    listener({ type: 'done' });
    return;
  }
  // در حال حاضر بدون SSE واقعی — یک‌بار پاسخ تقریبی برمی‌گرداند
  try {
    const res = await fetchAPI<{ message?: string; response?: string }>('/chat/', {
      method: 'POST',
      body: JSON.stringify({ message, scope: _scope }),
    });
    listener({
      type: 'assistant',
      text: res?.message || res?.response || 'پاسخی دریافت نشد.',
    });
    listener({ type: 'done' });
  } catch (err) {
    listener({
      type: 'assistant',
      text: err instanceof Error ? err.message : 'خطا در ارتباط با ایجنت.',
    });
    listener({ type: 'error' });
  }
}

// ═════════════════════════════════════════════════════
// MOCK IMPLEMENTATIONS
// ═════════════════════════════════════════════════════

function mockAnalyzeMatch(): AnalyzeMatchResponse {
  return {
    match_result: {
      overall_decision: 'good_match',
      overall_score: 76,
      technical_fit: { score: 32, max_score: 40, status: 'match', explanation: 'تطابق فنی خوبی وجود دارد.' },
      experience_fit: { score: 15, max_score: 15, status: 'match', explanation: 'تجربهٔ کافی داری.' },
      education_fit: { score: 10, max_score: 10, status: 'match', explanation: 'تحصیلات تطابق دارد.' },
      career_goal_fit: { score: 12, max_score: 15, status: 'partial', explanation: 'هدف شغلی تا حدی هم‌راستاست.' },
      preference_fit: { score: 7, max_score: 10, status: 'partial', explanation: 'ترجیحات شما تا حدی رعایت شده‌اند.' },
      constraint_fit: { score: 8, max_score: 10, status: 'match', explanation: 'محدودیت‌ها رعایت شده‌اند.' },
      skill_matches: [],
      matching_skills: ['React', 'JavaScript', 'TypeScript'],
      missing_required_skills: [],
      missing_preferred_skills: ['GraphQL'],
      uncertain_matches: ['Docker'],
      strengths: ['مهارت‌های React قوی', 'تجربهٔ ۵ سال توسعهٔ وب', 'ارتباط خوب'],
      gaps: ['تقویت مهارت DevOps', 'عدم تجربهٔ مستقیم با GraphQL'],
      risks: ['امکان دورهٔ آموزشی کوتاه'],
      constraints: [
        { category: 'شهر', value: 'تهران', hard: true, status: 'satisfied', explanation: 'شهر مطابقت دارد.', evidence: [] },
      ],
      reasoning: 'تطابق خوبی وجود دارد. شکاف‌ها در نظر گرفته شوند.',
      recommendation: 'این فرصت ارزش بررسی و اقدام دارد.',
      methodology_version: 'match-decision/1',
      llm_explanation_used: false,
    },
    job_source: 'analyzed',
  };
}

function mockListResumes(): ResumeSummary[] {
  return [
    { id: 1, version: 1, title: 'رزومهٔ من', active: true, updated_at: new Date().toISOString() },
  ];
}

function mockCreateResume(data?: { title?: string; content?: ResumeContent }): ResumeDetail {
  return {
    id: Math.floor(Math.random() * 1000) + 1,
    version: 1,
    title: data?.title || 'رزومهٔ من',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    content: data?.content || mockDefaultResumeContent(),
  };
}

function mockGetResume(id: number | string): ResumeDetail {
  return {
    id: Number(id),
    version: 1,
    title: 'رزومهٔ من',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    content: mockDefaultResumeContent(),
  };
}

function mockUpdateResume(
  id: number | string,
  patch: { title?: string; content?: ResumeContent; active?: boolean }
): ResumeDetail {
  return {
    id: Number(id),
    version: 2,
    title: patch.title || 'رزومهٔ من',
    active: patch.active !== false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    content: patch.content || mockDefaultResumeContent(),
  };
}

function mockDefaultResumeContent(): ResumeContent {
  return {
    full_name: 'کاربر مهندس',
    headline: 'توسعه‌دهندهٔ فرانت‌اند',
    email: 'user@example.com',
    phone: '',
    city: 'تهران',
    summary: 'توسعه‌دهندهٔ React با ۵ سال تجربه.',
    skills: [{ name: 'React' }, { name: 'TypeScript' }, { name: 'JavaScript' }],
    experiences: [
      { title: 'توسعه‌دهندهٔ ارشد', company: 'شرکت نمونه', description: 'توسعهٔ پلتفرم‌های بزرگ با ۵ سال سابقه در تیم‌های ۱۰ نفره.', start: '1400', end: '' },
    ],
    projects: [],
    educations: [{ degree: 'کارشناسی کامپیوتر', school: 'دانشگاه تهران' }],
    languages: [{ name: 'فارسی', level: 'زبان مادری' }],
    links: [],
  };
}

function mockGetTruthReport(_resumeId: number | string): TruthReportResponse {
  return {
    resume_id: Number(_resumeId) || 1,
    truth_report: [
      {
        claim_text: '۵ سال',
        claim_type: 'quantitative',
        status: 'verified',
        evidence_ref: { type: 'experience', title: 'توسعه‌دهندهٔ ارشد', company: 'شرکت نمونه' },
        context: 'توسعه‌دهندهٔ ارشد',
      },
      {
        claim_text: '۱۰ نفره',
        claim_type: 'quantitative',
        status: 'needs_clarification',
        evidence_ref: null,
        suggestion: 'این عدد نیاز به مدرک یا توضیح بیشتری دارد.',
        context: 'تجربهٔ شغلی',
      },
    ],
    overall_truth_score: 0.72,
    verified_claims: 8,
    unsupported_claims: 1,
    needs_clarification_claims: 2,
  };
}

function mockAnalyzeWhatIf(_req: WhatIfRequest): WhatIfResponse {
  return {
    before_count: { strong_match: 2, good_match: 3 },
    after_count: { strong_match: 4, good_match: 5 },
    delta: { strong_match: 2, good_match: 2 },
    upgraded_jobs: [],
  };
}

function mockConfirmHiddenSkill(
  req: HiddenSkillConfirmRequest
): HiddenSkillConfirmResponse {
  return {
    status: req.accept !== false ? 'confirmed' : 'rejected',
    skill: { name: req.skill_name, status: req.accept !== false ? 'confirmed' : 'rejected' },
  };
}

function mockGetGapPriority(): GapPriorityResponse {
  return {
    prioritized_gaps: [
      {
        skill: 'SQL',
        jobs_unlocked: 5,
        jobs_mentioning: 8,
        score_gain: 34,
        impact_score: 62,
        sample_job_titles: ['Senior Backend Developer', 'Data Analyst'],
        sample_jobs: [],
      },
      {
        skill: 'Docker',
        jobs_unlocked: 3,
        jobs_mentioning: 6,
        score_gain: 18,
        impact_score: 37,
        sample_job_titles: ['DevOps Engineer'],
        sample_jobs: [],
      },
    ],
  };
}

function mockGetCareerMemory(): CareerMemorySnapshot {
  return {
    skills: [
      { name: 'React', status: 'confirmed', level: 'advanced', years_of_experience: 5 },
      { name: 'TypeScript', status: 'confirmed', level: 'advanced' },
    ],
    experiences: [
      { title: 'توسعه‌دهندهٔ فرانت‌اند', company: 'شرکت نمونه', description: 'کار با React و TypeScript' },
    ],
    projects: [],
    verified_skills: [
      { name: 'React', status: 'confirmed', level: 'advanced', years_of_experience: 5 },
      { name: 'TypeScript', status: 'confirmed', level: 'advanced' },
    ],
    skills_needing_clarification: [],
  };
}

function mockStartInterview(
  _req: InterviewStartRequest
): InterviewStartResponse {
  return {
    interview_id: 'mock-interview-001',
    questions: [
      { index: 1, question: 'درباره آخرین پروژهٔ React‌ات توضیح بده.', type: 'long' },
      { index: 2, question: 'State management چطور handle می‌کنی؟', type: 'long' },
      { index: 3, question: 'یک bug معمول در React چیست و چطور آن را حل می‌کنی؟', type: 'long' },
    ],
  };
}

function mockAnswerInterviewQuestion(
  _req: InterviewAnswerRequest
): InterviewAnswerResponse {
  return {
    feedback: 'پاسخ خوبی بود، اما سعی کن بیشتر جزئیات بده.',
    score: 7,
    next_question: undefined,
    completed: true,
  };
}

// Backward-compat — تابع قدیمی همچنان کار کند
export { fetchAPI };
