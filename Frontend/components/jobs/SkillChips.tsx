"use client";

import { jobsTheme } from "./theme";

interface SkillChipsProps {
  skills: string[];
  tone?: "neutral" | "success" | "danger";
  size?: "sm" | "md";
}

export default function SkillChips({ skills, tone = "neutral", size = "sm" }: SkillChipsProps) {
  if (!skills || skills.length === 0) return null;

  const colors =
    tone === "success"
      ? { bg: jobsTheme.successSoft, fg: jobsTheme.success }
      : tone === "danger"
        ? { bg: jobsTheme.dangerSoft, fg: jobsTheme.danger }
        : { bg: jobsTheme.primarySofter, fg: jobsTheme.primaryDark };

  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span
          key={skill}
          className={`inline-flex items-center rounded-full font-medium ${pad}`}
          style={{ backgroundColor: colors.bg, color: colors.fg }}
        >
          {skill}
        </span>
      ))}
    </div>
  );
}
