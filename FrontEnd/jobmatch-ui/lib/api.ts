"use client";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api";

const TOKEN_KEY = "jm_access";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export interface AuthUser {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(API_BASE + path, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/")) {
      window.location.href = "/";
    }
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = typeof data === "object" ? JSON.stringify(data) : String(data);
    } catch {}
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ---- types ----
export interface Profile {
  full_name: string;
  headline: string;
  skills: string[];
  experience_years: number;
  level: string;
  target_role: string;
  city: string;
  remote_only: boolean;
  min_salary?: number | null;
  education?: string;
  completed: boolean;
}

export interface Job {
  id: number;
  title: string;
  company: string;
  city: string;
  level: string;
  required_skills: string[];
  optional_skills: string[];
  job_types: string[];
  salary_min: number | null;
  salary_max: number | null;
  description: string;
  source: string;
}

export interface MatchRow {
  id: number;
  job: Job;
  score: number;
  breakdown: Record<string, number>;
  reasons: string[];
  missing_skills: string[];
  status: string;
}

export interface Resume {
  id: number;
  version: number;
  title: string;
  content: ResumeContent;
  active: boolean;
}

export interface ExperienceItem {
  title: string;
  company: string;
  start: string;
  end: string;
  description?: string;
  bullets: string[];
}

export interface ResumeContent {
  full_name?: string;
  headline?: string;
  email?: string;
  phone?: string;
  city?: string;
  summary?: string;
  language?: string;
  is_english?: boolean;
  skills?: { name: string }[];
  experiences?: ExperienceItem[];
  projects?: { name: string; description: string; technologies: string[] }[];
  educations?: { degree: string; school: string; start: string; end: string }[];
  languages?: { name: string; level: string }[];
  links?: { label: string; url: string }[];
}

// export async function translateResume(resumeId: number) {
//   return api<Resume>(`/resumes/${resumeId}/translate/`, {
//     method: "POST",
//   });
// }

// ---- auth ----
export async function register(username: string, password: string) {
  return api<{ id: number; username: string }>("/auth/register/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function login(username: string, password: string) {
  const data = await api<{ access: string; profile_completed: boolean }>(
    "/auth/token/",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
  );
  setToken(data.access);
  return data;
}

// ---- SSE chat ----
export async function streamChat(
  message: string,
  task: string,
  onEvent: (event: {
    type: string;
    text?: string;
    name?: string;
    result?: unknown;
  }) => void,
) {
  const token = getToken();
  const res = await fetch(API_BASE + "/chat/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (token || ""),
    },
    body: JSON.stringify({ message, task }),
  });
  if (!res.ok || !res.body) {
    throw new Error("chat failed");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()));
      } catch {}
    }
  }
}

// ---- Job Analyzer Types ----
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

export async function analyzeJob(description: string): Promise<JobAnalysisResult> {
  return api<JobAnalysisResult>("/chat/analyze-job/", {
    method: "POST",
    body: JSON.stringify({ description }),
  });
}
