/**
 * Utility functions for Resume Wizard
 */

import type {
  PendingChange,
  SkillChangeData,
  ExperienceChangeData,
  EducationChangeData,
  LanguageChangeData,
  ProjectChangeData,
} from './types';
import type { CareerMemorySnapshot, ResumeContent } from '@/lib/api';

// ═════════════════════════════════════════════════════
// Build Proposed Resume Content
// ═════════════════════════════════════════════════════

export function buildProposedResume(
  careerMemory: CareerMemorySnapshot,
  pendingChanges: PendingChange[]
): ResumeContent {
  const content: ResumeContent = {};

  // Skills - only include confirmed skills from Career Memory + user-confirmed changes
  const confirmedSkills = careerMemory.skills.filter((s: { status: string }) => s.status === 'confirmed');
  const skillChanges = pendingChanges.filter(c => c.type === 'skill' && c.confirmed);

  content.skills = [
    ...confirmedSkills.map((s: { name: string }) => ({ name: s.name })),
    ...skillChanges
      .filter(c => c.action === 'add' || c.action === 'confirm')
      .map(c => {
        const data = c.data as SkillChangeData;
        return { name: data.name };
      }),
  ];

  // Experiences - only include those with evidence or explicitly confirmed
  const confirmedExperiences = careerMemory.experiences.filter((e: { description?: string }) => {
    // Check if experience has evidence (simplified check)
    return e.description && e.description.length > 0;
  });
  const experienceChanges = pendingChanges.filter(c => c.type === 'experience' && c.confirmed);

  content.experiences = [
    ...confirmedExperiences.map((e: { title?: string; company?: string; description?: string; start?: string; end?: string }) => ({
      title: e.title,
      company: e.company,
      description: e.description,
      start: e.start,
      end: e.end,
    })),
    ...experienceChanges
      .filter(c => c.action === 'add' || c.action === 'confirm')
      .map(c => {
        const data = c.data as ExperienceChangeData;
        return {
          title: data.title,
          company: data.company,
          description: data.description,
          start: data.start,
          end: data.end,
        };
      }),
  ];

  // Education
  const educationChanges = pendingChanges.filter(c => c.type === 'education' && c.confirmed);
  content.educations = [
    ...educationChanges
      .filter(c => c.action === 'add' || c.action === 'confirm')
      .map(c => {
        const data = c.data as EducationChangeData;
        return {
          degree: data.degree,
          school: data.school,
          field: data.field,
          start: data.start,
          end: data.end,
        };
      }),
  ];

  // Languages
  const languageChanges = pendingChanges.filter(c => c.type === 'language' && c.confirmed);
  content.languages = [
    ...languageChanges
      .filter(c => c.action === 'add' || c.action === 'confirm')
      .map(c => {
        const data = c.data as LanguageChangeData;
        return { name: data.name, level: data.level };
      }),
  ];

  // Projects
  const projectChanges = pendingChanges.filter(c => c.type === 'project' && c.confirmed);
  content.projects = [
    ...careerMemory.projects.map((p: { name?: string; description?: string }) => ({
      name: p.name,
      description: p.description,
    })),
    ...projectChanges
      .filter(c => c.action === 'add' || c.action === 'confirm')
      .map(c => {
        const data = c.data as ProjectChangeData;
        return {
          name: data.name,
          description: data.description,
          link: data.link,
        };
      }),
  ];

  return content;
}

// ═════════════════════════════════════════════════════
// Change Management
// ═════════════════════════════════════════════════════

export function generateChangeId(): string {
  return `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function hasEvidence(change: PendingChange): boolean {
  // Skills from Career Memory are considered to have evidence
  if (change.type === 'skill') {
    const data = change.data as SkillChangeData;
    return data.source === 'career_memory';
  }
  // Experiences with description are considered to have evidence
  if (change.type === 'experience') {
    const data = change.data as ExperienceChangeData;
    return !!data.description && data.description.length > 0;
  }
  // Other types require explicit evidence (not implemented in this version)
  return false;
}

// ═════════════════════════════════════════════════════
// Validation
// ═════════════════════════════════════════════════════

export function validateStep1(state: {
  selectedJob: unknown;
  matchResult: unknown;
}): boolean {
  return !!state.selectedJob && !!state.matchResult;
}

export function validateStep2(pendingChanges: PendingChange[]): boolean {
  // At least one change must be confirmed
  return pendingChanges.some(c => c.confirmed);
}

export function validateStep3(proposedResume: ResumeContent | null): boolean {
  if (!proposedResume) return false;
  // Must have at least skills or experiences
  const hasSkills = proposedResume.skills && proposedResume.skills.length > 0;
  const hasExperiences = proposedResume.experiences && proposedResume.experiences.length > 0;
  return Boolean(hasSkills || hasExperiences);
}

// ═════════════════════════════════════════════════════
// PDF Download Validation
// ═════════════════════════════════════════════════════

export function validatePdfResponse(
  contentType: string | null,
  pdfModeHeader: string | null
): { valid: boolean; error?: string } {
  if (!contentType) {
    return { valid: false, error: 'No Content-Type header received' };
  }

  if (contentType.includes('application/pdf')) {
    return { valid: true };
  }

  if (pdfModeHeader === 'html') {
    return {
      valid: false,
      error: 'Server returned HTML instead of PDF. PDF generation may be unavailable.',
    };
  }

  return {
    valid: false,
    error: `Unexpected Content-Type: ${contentType}. Expected application/pdf.`,
  };
}
