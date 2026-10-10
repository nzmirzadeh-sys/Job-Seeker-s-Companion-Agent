import type { AssistantProfile } from './types';

export function normalizeText(value: string): string { return value.trim().toLowerCase(); }

export function parseRoleFromText(value: string): string | undefined {
  const text = normalizeText(value);
  if (!text) return undefined;

  const keywords = ['فرانت‌اند', 'front-end', 'front end', 'بک‌اند', 'backend', 'fullstack', 'full-stack', 'ui', 'ux', 'product', 'data analyst', 'data-analyst'];
  const match = keywords.find((keyword) => text.includes(keyword));
  return match ? match : undefined;
}

export function parseSkillsFromText(value: string): string[] {
  const text = normalizeText(value);
  if (!text) return [];

  const known = ['react', 'next.js', 'typescript', 'javascript', 'node.js', 'python', 'django', 'sql', 'ux', 'ui', 'data', 'product', 'figma', 'tailwind', 'design', 'testing'];
  return known.filter((skill) => text.includes(skill));
}

export function enrichProfileFromInput(input: string, previous: AssistantProfile): AssistantProfile {
  const next: AssistantProfile = { ...previous, skills: [...(previous.skills ?? [])] };
  const normalized = normalizeText(input);

  if (!normalized) return next;

  const role = parseRoleFromText(input);
  if (role) next.role = role;

  const skillMatches = parseSkillsFromText(input);
  if (skillMatches.length) {
    for (const skill of skillMatches) {
      if (!next.skills.includes(skill)) next.skills.push(skill);
    }
  }

  return next;
}
