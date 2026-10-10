"use client";

import { scoreBand } from "./theme";

interface MatchScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  withLabel?: boolean;
}

export default function MatchScoreBadge({
  score,
  size = "md",
  withLabel = false,
}: MatchScoreBadgeProps) {
  const band = scoreBand(score);

  const dims =
    size === "lg"
      ? { box: 72, num: "text-2xl", denom: "text-[11px]" }
      : size === "sm"
        ? { box: 44, num: "text-sm", denom: "text-[9px]" }
        : { box: 56, num: "text-lg", denom: "text-[10px]" };

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div
        className="flex shrink-0 flex-col items-center justify-center rounded-2xl font-extrabold"
        style={{
          width: dims.box,
          height: dims.box,
          backgroundColor: band.soft,
          color: band.color,
        }}
      >
        <span className={dims.num}>{score}</span>
        <span className={`${dims.denom} font-medium opacity-80`}>از ۱۰۰</span>
      </div>

      {withLabel && (
        <span
          className="whitespace-nowrap text-[11px] font-bold"
          style={{ color: band.color }}
        >
          {band.label}
        </span>
      )}
    </div>
  );
}
