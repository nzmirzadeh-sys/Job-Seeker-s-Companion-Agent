'use client';

import React from 'react';
import { clsx } from 'clsx';

interface PercentageRingProps {
  percentage: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}

const PercentageRing: React.FC<PercentageRingProps> = ({
  percentage,
  label,
  size = 'md',
  color = 'default',
  className,
}) => {
  const sizes = {
    sm: { outer: 60, inner: 50, textSize: 'text-sm' },
    md: { outer: 80, inner: 70, textSize: 'text-base' },
    lg: { outer: 120, inner: 105, textSize: 'text-lg' },
  };

  const colors = {
    default: '#0066cc',
    success: '#006633',
    warning: '#cc6600',
    error: '#cc0000',
  };

  const { outer, inner, textSize } = sizes[size];
  const circumference = 2 * Math.PI * (inner / 2);
  const offset = circumference - (percentage / 100) * circumference;

  const colorValue = colors[color];
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  // فارسی‌سازی اعداد
  const persianPercentage = clampedPercentage.toString().replace(/\d/g, (d) => {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return persianDigits[parseInt(d)];
  });

  return (
    <div className={clsx('flex flex-col items-center gap-2', className)}>
      <svg
        width={outer}
        height={outer}
        className="drop-shadow-sm"
        style={{ direction: 'ltr' }}
      >
        {/* Outer border */}
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={outer / 2 - 2}
          fill="none"
          stroke="var(--border-primary)"
          strokeWidth="2"
        />

        {/* Background circle (unfilled portion) */}
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={inner / 2}
          fill="none"
          stroke="var(--border-light)"
          strokeWidth="2"
          opacity="0.3"
        />

        {/* Filled circle (progress) */}
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={inner / 2}
          fill="none"
          stroke={colorValue}
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="butt"
          transform={`rotate(-90 ${outer / 2} ${outer / 2})`}
          style={{
            transition: 'stroke-dashoffset 300ms ease-in-out',
            direction: 'ltr',
          }}
        />

        {/* Text content */}
        <text
          x={outer / 2}
          y={outer / 2 - 5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="18"
          fontWeight="bold"
          fill="var(--text-primary)"
          fontFamily="Courier New, monospace"
          direction="ltr"
        >
          {persianPercentage}٪
        </text>
      </svg>

      {label && (
        <div className={clsx('text-center font-bold', textSize)}>
          {label}
        </div>
      )}
    </div>
  );
};

export default PercentageRing;
