export type AssistantStage = 'start' | 'intake' | 'confirm' | 'results';
export type AssistantQuickAction =
  | 'find_jobs'
  | 'resume_analysis'
  | 'interview_prep'
  | 'growth_path';

export interface AssistantProfile {
  name?: string;
  role?: string;
  experience?: string;
  location?: string;
  remote?: string;
  skills: string[];
  expectations?: string;
}

export interface AssistantJobCard {
  id: number | string;
  title: string;
  company: string;
  city: string;
  type: string;
  match: number;
  matchLabel: string;
  summary: string;
  skills: string[];
  url?: string;
}

export interface AssistantMessage {
  id: number;
  role: 'assistant' | 'user';
  content: string;
}

export interface AssistantQuickActionResult {
  title: string;
  summary: string;
  status: 'ok' | 'soon';
}
