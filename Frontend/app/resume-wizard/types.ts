
/**
 * Types for Resume Wizard
 * Based on actual API contracts from Backend
 */

import type {
  MatchRow,
  MatchDecisionResult,
  CareerMemorySnapshot,
  GapPriorityResponse,
  ResumeContent,
  TruthReportResponse,
} from '@/lib/api';

// Re-export types from lib/api for convenience
export type {
  MatchRow,
  MatchDecisionResult,
  CareerMemorySnapshot,
  GapPriorityResponse,
  ResumeContent,
  TruthReportResponse,
} from '@/lib/api';

// ═════════════════════════════════════════════════════
// Wizard Step State
// ═════════════════════════════════════════════════════

export type WizardStep = 1 | 2 | 3;

export interface WizardState {
  currentStep: WizardStep;

  // Step 1: Job Selection
  selectedJob: MatchRow | null;
  matchResult: MatchDecisionResult | null;
  gapPriority: GapPriorityResponse | null;
  careerMemory: CareerMemorySnapshot | null;

  // Step 2: Alignment (pending changes)
  pendingChanges: PendingChange[];

  // Step 3: Review & Save
  proposedResume: ResumeContent | null;
  savedResumeId: number | null;
  truthReport: TruthReportResponse | null;
  isSaving: boolean;
  saveError: string | null;
}

// ═════════════════════════════════════════════════════
// Pending Changes (Step 2)
// ═════════════════════════════════════════════════════

export type ChangeType =
  | 'skill'
  | 'experience'
  | 'education'
  | 'language'
  | 'project';

export type ChangeAction = 'add' | 'confirm' | 'reject' | 'edit';

export interface PendingChange {
  id: string;
  type: ChangeType;
  action: ChangeAction;
  data: unknown;
  confirmed: boolean;
  hasEvidence: boolean;
}

export interface SkillChangeData {
  name: string;
  level?: string;
  years_of_experience?: number;
  source?: 'career_memory' | 'user_input';
}

export interface ExperienceChangeData {
  title?: string;
  company?: string;
  description?: string;
  start?: string;
  end?: string;
  source?: 'career_memory' | 'user_input';
}

export interface EducationChangeData {
  degree?: string;
  school?: string;
  field?: string;
  start?: string;
  end?: string;
  source?: 'career_memory' | 'user_input';
}

export interface LanguageChangeData {
  name: string;
  level: string;
  source?: 'career_memory' | 'user_input';
}

export interface ProjectChangeData {
  name?: string;
  description?: string;
  link?: string;
  source?: 'career_memory' | 'user_input';
}

// ═════════════════════════════════════════════════════
// Validation States
// ═════════════════════════════════════════════════════

export interface ValidationState {
  step1Complete: boolean;
  step2Complete: boolean;
  step3Complete: boolean;
  canProceedToStep2: boolean;
  canProceedToStep3: boolean;
}

// ═════════════════════════════════════════════════════
// Error States
// ═════════════════════════════════════════════════════

export interface WizardError {
  step: WizardStep;
  message: string;
  retryable: boolean;
}