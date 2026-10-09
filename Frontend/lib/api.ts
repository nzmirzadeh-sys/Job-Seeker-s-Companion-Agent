/**
 * API Layer - لایهٔ یکپارچه برای تمام فراخوانی‌های API
 * بر اساس شکل واقعی endpoint های Backend
 */

// باید با build-arg "NEXT_PUBLIC_API_BASE" در Dockerfile و docker-compose.yml یکی باشد.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api';
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

// ═════════════════════════════════════════════════════
// TYPES — مطابق مدل واقعی Pydantic در Backend
// ═════════════════════════════════════════════════════

// ── Shared / Common ──────────────────────────────────
export interface Profile {
  completed: boolean;
  full_name?: string;
  headline?: string;
  skills?: string[];
  experience_years?: number;
  level?: string;
  target_role?: string;
  city?: string;
  remote_only?: boolean;
  min_salary?: number | null;
  education?: string;
}

export type ApplicationStatus =
  | 'APPLIED'
  | 'SCREENING'
  | 'INTERVIEW'
  | 'OFFER'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'NO_RESPONSE';

export interface JobApplication {
  id: number;
  company: string;
  job_title: string;
  job_posting: number | null;
  applied_on: string;
  status: ApplicationStatus;
  outcome_reason: string;
  required_skills: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApplicationSuggestionsResponse {
  count: number;
  results: ApplicationSuggestion[];
}

export interface ApplicationSuggestion {
  id: number;
  suggestion: string;
  evidence: {
    comparable_applications: number;
    supporting_observations: string[];
  };
  confidence: 'low';
  requires_user_confirmation: true;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface GeneratedApplicationSuggestions {
  insufficient_data: boolean;
  detail: string;
  results: ApplicationSuggestion[];
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
  required_skills?: string[];
  optional_skills?: string[];
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

// ── Interview endpoints ──────────────────────────────
export type InterviewType = 'technical' | 'behavioral' | 'general';

export interface CanonicalJobAnalysis {
  title: { value: string; explicit: boolean; source_text: string | null } | null;
  company: { value: string; explicit: boolean; source_text: string | null } | null;
  seniority: { value: string; explicit: boolean; source_text: string | null } | null;
  employment_type: { value: string; explicit: boolean; source_text: string | null } | null;
  location: { value: string; explicit: boolean; source_text: string | null } | null;
  education: { value: string; explicit: boolean; source_text: string | null } | null;
  salary: {
    min_amount: number | null;
    max_amount: number | null;
    currency: string | null;
    period: string | null;
    source_text: string | null;
  } | null;
  years_experience: {
    min_years: number | null;
    max_years: number | null;
    source_text: string | null;
  } | null;
  required_skills: Array<{
    name: string;
    category: string;
    explicit: boolean;
    source_text: string | null;
  }>;
  preferred_skills: Array<{
    name: string;
    category: string;
    explicit: boolean;
    source_text: string | null;
  }>;
  responsibilities: Array<{ value: string; explicit: boolean; source_text: string | null }>;
  qualifications: Array<{ value: string; explicit: boolean; source_text: string | null }>;
  certifications: Array<{ value: string; explicit: boolean; source_text: string | null }>;
  languages: Array<{ value: string; explicit: boolean; source_text: string | null }>;
  other_requirements: Array<{ value: string; explicit: boolean; source_text: string | null }>;
}

export interface InterviewQuestion {
  question: string;
  difficulty: string;
  rationale: string;
  competency: string;
  purpose: string;
  assessment_criteria: string[];
}

export interface InterviewCriterionEvaluation {
  criterion: string;
  score: number | null;
  explanation: string;
  evidence: string[];
  weight: number;
  required: boolean;
}

export interface InterviewFeedback {
  competency?: string;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  better_answer_hint: string;
  criteria: InterviewCriterionEvaluation[];
  overall_score: number | null;
  insufficient_evidence: boolean;
  improvement_suggestions: string[];
  follow_up_question: string | null;
  evaluation_version: string;
}

export interface InterviewSummary {
  overall_feedback: string;
  topics_to_study: string[];
  competencies_covered: string[];
  strengths: string[];
  areas_needing_evidence: string[];
  next_steps: string[];
  evaluation_version: string;
}

export interface InterviewSession {
  id: number;
  job_posting_id: number | null;
  job_title: string;
  job_analysis: CanonicalJobAnalysis;
  interview_type: InterviewType;
  rubric_version: string;
  max_questions: number;
  persona: string;
  questions: InterviewQuestion[];
  answers: string[];
  feedback_history: InterviewFeedback[];
  status: 'in_progress' | 'done' | 'cancelled';
  summary: InterviewSummary | null;
  question_number: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface InterviewHistoryItem {
  id: number;
  job_posting_id: number | null;
  job_title: string;
  interview_type: InterviewType;
  rubric_version: string;
  status: InterviewSession['status'];
  question_count: number;
  answered_count: number;
  created_at: string;
  updated_at: string;
  summary: InterviewSummary | null;
}

export interface InterviewHistoryResponse {
  count: number;
  results: InterviewHistoryItem[];
}

export interface InterviewStartRequest {
  job_id?: number | string;
  job_analysis?: CanonicalJobAnalysis | { job: CanonicalJobAnalysis };
  interview_type: InterviewType;
  max_questions?: number;
  persona?: string;
}

export interface InterviewStartResponse {
  session_id: number;
  question: InterviewQuestion;
  question_number: number;
  max_questions: number;
  remaining_questions: number;
  is_final: boolean;
  interview_type: InterviewType;
  rubric_version: string;
  memory_unavailable: boolean;
}

export interface InterviewAnswerRequest {
  session_id: number;
  answer: string;
  expected_question_number: number;
}

export interface InterviewAnswerResponse {
  feedback: InterviewFeedback;
  next_question: InterviewQuestion | null;
  is_complete: boolean;
  summary: InterviewSummary | null;
  question_number: number;
  remaining_questions: number;
  rubric_version: string;
  memory_unavailable: boolean;
}

export interface InterviewProgressResponse {
  baseline_only: boolean;
  trend_available: boolean;
  detail: string;
  interview_type: InterviewType | null;
  rubric_version: string;
  comparable_sessions: number;
  incompatible_sessions_excluded: number;
  competencies: Array<{
    competency: string;
    observations: Array<{ session_id: number; date: string; score: number }>;
    change: number | null;
  }>;
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

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Network error: ${error.message}`, { cause: error });
    }
    throw new Error('Network error: could not reach the server.');
  }

  if (response.status === 401) {
    clearToken();
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.location.href = '/';
    }
    throw new Error('unauthorized');
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const error: unknown = await response.json();
      if (typeof error === 'string') {
        message = error;
      } else if (typeof error === 'object' && error !== null) {
        const fields = error as Record<string, unknown>;
        const detail = fields.detail ?? fields.message;
        if (typeof detail === 'string') {
          message = detail;
        } else if (
          typeof fields.error === 'object' &&
          fields.error !== null &&
          'message' in fields.error &&
          typeof fields.error.message === 'string'
        ) {
          message = fields.error.message;
        } else {
          const validationMessages = Object.entries(fields).flatMap(
            ([field, value]) => {
              const messages = Array.isArray(value)
                ? value.filter((item): item is string => typeof item === 'string')
                : typeof value === 'string'
                  ? [value]
                  : [];
              return messages.map((item) => `${field}: ${item}`);
            }
          );
          if (validationMessages.length > 0) {
            message = validationMessages.join(' ');
          }
        }
      }
    } catch {
      // Keep the HTTP status message when an error response has no JSON body.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

// Alias برای سازگاری با import های موجود در صفحات
export const api = fetchAPI;

// ═════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ═════════════════════════════════════════════════════

export async function register(
  username: string,
  password: string,
  email?: string
): Promise<{ id: number; username: string }> {
  return fetchAPI<{ id: number; username: string }>('/auth/register/', {
    method: 'POST',
    body: JSON.stringify({ username, password, ...(email ? { email } : {}) }),
  });
}

export async function login(
  username: string,
  password: string
): Promise<{ access: string; profile_completed: boolean }> {
  const data = await fetchAPI<{ access: string; profile_completed: boolean }>(
    '/auth/token/',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }
  );
  setToken(data.access);
  return data;
}

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
  return api<InterviewStartResponse>('/interview/start/', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function answerInterviewQuestion(
  req: InterviewAnswerRequest
): Promise<InterviewAnswerResponse> {
  return api<InterviewAnswerResponse>('/interview/answer/', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function getInterviewSessions(params?: {
  limit?: number;
  offset?: number;
}): Promise<InterviewHistoryResponse> {
  const query = new URLSearchParams({
    limit: String(params?.limit ?? 50),
    offset: String(params?.offset ?? 0),
  });
  return api<InterviewHistoryResponse>(
    `/interview/history/?${query.toString()}`
  );
}

export async function getInterviewSession(
  sessionId: number
): Promise<InterviewSession> {
  return api<InterviewSession>(`/interview/${sessionId}/`);
}

export async function getInterviewReport(
  sessionId: number
): Promise<InterviewSession & {
  report: {
    summary: InterviewSummary | null;
    questions_and_evaluations: Array<{
      question: InterviewQuestion;
      answer: string | null;
      evaluation: InterviewFeedback | null;
    }>;
    progress: InterviewProgressResponse;
  };
}> {
  return api(`/interview/reports/${sessionId}/`);
}

export async function getInterviewProgress(
  interviewType?: InterviewType
): Promise<InterviewProgressResponse> {
  const query = interviewType
    ? `?interview_type=${encodeURIComponent(interviewType)}`
    : '';
  return api<InterviewProgressResponse>(`/interview/progress/${query}`);
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
// JOB ANALYZER ENDPOINTS
// ═════════════════════════════════════════════════════

export interface SkillRequirement {
  name: string;
  source_text?: string | null;
  explicit: boolean;
}

export interface ExperienceRequirement {
  min_years?: number | null;
  max_years?: number | null;
  source_text?: string | null;
}

export interface EducationRequirement {
  level?: string | null;
  field?: string | null;
  source_text?: string | null;
}

export interface SalaryInfo {
  min?: number | null;
  max?: number | null;
  currency?: string | null;
  source_text?: string | null;
}

export interface AnalyzedJob {
  title?: string | null;
  company?: string | null;
  seniority?: string | null;
  employment_type?: string | null;
  location?: string | null;
  required_skills: SkillRequirement[];
  preferred_skills: SkillRequirement[];
  technologies: string[];
  tools: string[];
  experience_requirements?: ExperienceRequirement | null;
  education_requirements?: EducationRequirement[];
  certifications?: string[];
  languages?: string[];
  responsibilities?: string[];
  other_requirements?: string[];
  salary?: SalaryInfo | null;
  warnings: string[];
  source_text?: string | null;
  provider?: string | null;
  model?: string | null;
}

export interface JobAnalysisResult {
  job_analysis?: AnalyzedJob;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
}

export interface CanonicalJobAnalysisResponse {
  job_analysis: {
    job: CanonicalJobAnalysis;
    warnings: string[];
    analyzer_version: string;
    provider: string | null;
    model: string | null;
  };
}

export async function analyzeJobForInterview(
  description: string
): Promise<CanonicalJobAnalysisResponse> {
  return api<CanonicalJobAnalysisResponse>('/chat/analyze-job/', {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
}

export async function analyzeJob(description: string): Promise<JobAnalysisResult> {
  return fetchAPI<JobAnalysisResult>('/chat/analyze-job/', {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
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

// Backward-compat — تابع قدیمی همچنان کار کند
export { fetchAPI };

export async function listApplications(): Promise<PaginatedResponse<JobApplication>> {
  const limit = 100;
  const firstPage = await api<PaginatedResponse<JobApplication>>(
    `/applications/?limit=${limit}&offset=0`
  );
  const results = [...firstPage.results];
  for (let offset = results.length; offset < firstPage.count; offset += limit) {
    const page = await api<PaginatedResponse<JobApplication>>(
      `/applications/?limit=${limit}&offset=${offset}`
    );
    results.push(...page.results);
  }
  return { ...firstPage, next: null, results };
}

export async function getApplication(id: number): Promise<JobApplication> {
  return api<JobApplication>(`/applications/${id}/`);
}

export interface CreateApplicationRequest {
  company: string;
  job_title: string;
  applied_on: string;
  job_posting?: number | null;
  status?: ApplicationStatus;
  outcome_reason?: string;
  required_skills?: string[];
  notes?: string;
}

export async function createApplication(
  data: CreateApplicationRequest
): Promise<JobApplication> {
  return api<JobApplication>('/applications/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateApplication(
  id: number,
  data: Partial<JobApplication>
): Promise<JobApplication> {
  return api<JobApplication>(`/applications/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteApplication(id: number): Promise<void> {
  await api<void>(`/applications/${id}/`, { method: 'DELETE' });
}

export async function getApplicationSuggestions(): Promise<
  ApplicationSuggestionsResponse
> {
  return api<ApplicationSuggestionsResponse>('/applications/suggestions/');
}

export async function generateApplicationSuggestions(): Promise<GeneratedApplicationSuggestions> {
  return api<GeneratedApplicationSuggestions>('/applications/suggestions/', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function decideApplicationSuggestion(
  id: number,
  decision: 'accepted' | 'rejected'
): Promise<{
  id: number;
  status: 'accepted' | 'rejected';
  career_memory_updated: false;
}> {
  return api<{
    id: number;
    status: 'accepted' | 'rejected';
    career_memory_updated: false;
  }>(`/applications/suggestions/${id}/decision/`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
}
