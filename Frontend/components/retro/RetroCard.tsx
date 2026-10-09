'use client';

import React from 'react';
import { clsx } from 'clsx';

interface RetroCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: React.ReactNode;
  variant?: 'default' | 'solid' | 'error' | 'success' | 'warning';
}

const RetroCard = React.forwardRef<HTMLDivElement, RetroCardProps>(
  ({ className, title, children, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'retro-card',
      solid: 'retro-card with-border',
      error: 'retro-card error',
      success: 'retro-card success',
      warning: 'retro-card warning',
    };

    return (
      <div
        ref={ref}
        className={clsx(variants[variant], className)}
        {...props}
      >
        {title && (
          <div className="font-bold mb-2 text-[var(--text-primary)]">
            {title}
          </div>
        )}
        {children}
      </div>
    );
  }
);

RetroCard.displayName = 'RetroCard';

export default RetroCard;
