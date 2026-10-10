"use client";

import { Banknote, Briefcase, MapPin } from "lucide-react";
import type { MatchRowJob } from "@/lib/api";
import { formatSalary, jobTypeLabel, jobsTheme } from "./theme";

interface JobMetaChipsProps {
  job: MatchRowJob;
  size?: "sm" | "md";
}

export default function JobMetaChips({ job, size = "md" }: JobMetaChipsProps) {
  const salary = formatSalary(job.salary_min, job.salary_max);
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {job.city && (
        <span
          className={`inline-flex items-center gap-1 rounded-full font-medium ${pad}`}
          style={{ backgroundColor: jobsTheme.primarySofter, color: jobsTheme.primaryDark }}
        >
          <MapPin className="size-3" />
          {job.city}
        </span>
      )}

      {job.job_types?.map((type) => (
        <span
          key={type}
          className={`inline-flex items-center gap-1 rounded-full border font-medium ${pad}`}
          style={{ borderColor: jobsTheme.primary, color: jobsTheme.primaryDark }}
        >
          <Briefcase className="size-3" />
          {jobTypeLabel(type)}
        </span>
      ))}

      {salary && (
        <span
          className={`inline-flex items-center gap-1 rounded-full font-medium ${pad}`}
          style={{ backgroundColor: jobsTheme.successSoft, color: jobsTheme.success }}
        >
          <Banknote className="size-3" />
          {salary}
        </span>
      )}
    </div>
  );
}
