'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const retroButtonVariants = cva('retro-btn', {
  variants: {
    variant: {
      default: '',
      primary: 'primary',
      danger: 'bg-[var(--status-error)] text-white border-[color:var(--status-error)]',
      success: 'bg-[var(--status-success)] text-white border-[color:var(--status-success)]',
    },
    size: {
      sm: 'px-2 py-1 text-[12px]',
      md: 'px-3 py-2 text-[14px]',
      lg: 'px-4 py-3 text-[16px]',
    },
    disabled: {
      true: 'opacity-50 cursor-not-allowed',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

interface RetroButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof retroButtonVariants>, 'disabled'> {
  children: React.ReactNode;
}

const RetroButton = React.forwardRef<HTMLButtonElement, RetroButtonProps>(
  ({ className, variant, size, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={clsx(
        retroButtonVariants({ variant, size, disabled }),
        className
      )}
      {...props}
    />
  )
);

RetroButton.displayName = 'RetroButton';

export default RetroButton;
