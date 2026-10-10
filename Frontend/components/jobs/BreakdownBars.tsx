"use client";

import type { MatchBreakdown } from "@/lib/api";
import { breakdownDimensions, jobsTheme } from "./theme";

interface BreakdownBarsProps {
  breakdown: MatchBreakdown;
}

export default function BreakdownBars({ breakdown }: BreakdownBarsProps) {
  return (
    <div className="space-y-3">
      {breakdownDimensions.map((dim) => {
        const value = breakdown[dim.key] ?? 0;
        const pct = Math.max(0, Math.min(100, (value / dim.max) * 100));

        return (
          <div key={dim.key} className="flex items-center gap-3">
            <span
              className="w-14 shrink-0 text-xs font-bold tabular-nums"
              style={{ color: jobsTheme.text }}
            >
              {value}/{dim.max}
            </span>

            <div className="flex-1">
              <div
                className="h-2 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: jobsTheme.primarySoft }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${jobsTheme.primary}, ${jobsTheme.primaryDark})`,
                  }}
                />
              </div>
            </div>

            <span
              className="w-28 shrink-0 text-left text-xs font-medium"
              style={{ color: jobsTheme.textMuted }}
            >
              {dim.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
