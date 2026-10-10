"use client";

import { Check, X } from "lucide-react";
import { isNegativeReason, jobsTheme } from "./theme";

interface ReasonsListProps {
  reasons: string[];
}

export default function ReasonsList({ reasons }: ReasonsListProps) {
  if (!reasons || reasons.length === 0) return null;

  return (
    <ul className="space-y-2">
      {reasons.map((reason, index) => {
        const negative = isNegativeReason(reason);

        return (
          <li key={index} className="flex items-start gap-2 text-sm">
            <span
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: negative
                  ? jobsTheme.dangerSoft
                  : jobsTheme.successSoft,
                color: negative ? jobsTheme.danger : jobsTheme.success,
              }}
            >
              {negative ? (
                <X className="size-3" strokeWidth={3} />
              ) : (
                <Check className="size-3" strokeWidth={3} />
              )}
            </span>

            <span style={{ color: jobsTheme.text }}>{reason}</span>
          </li>
        );
      })}
    </ul>
  );
}
