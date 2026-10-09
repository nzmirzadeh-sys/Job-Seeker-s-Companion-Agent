'use client';

import React from 'react';
import { clsx } from 'clsx';

interface ChecklistItemProps extends Omit<React.HTMLAttributes<HTMLLabelElement>, 'onChange'> {
  id: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  variant?: 'default' | 'success' | 'error';
}

const ChecklistItem = React.forwardRef<HTMLLabelElement, ChecklistItemProps>(
  (
    {
      id,
      label,
      checked = false,
      disabled = false,
      onChange,
      variant = 'default',
      className,
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      default: {
        border: 'border-[var(--border-primary)]',
        checkColor: 'text-[var(--text-primary)]',
      },
      success: {
        border: 'border-[var(--status-success)]',
        checkColor: 'text-[var(--status-success)]',
      },
      error: {
        border: 'border-[var(--status-error)]',
        checkColor: 'text-[var(--status-error)]',
      },
    };

    const style = variantStyles[variant];

    return (
      <label
        ref={ref}
        className={clsx(
          'flex items-center gap-3 cursor-pointer py-1 px-2',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        {/* Checkbox - Retro style */}
        <div
          className={clsx(
            'flex items-center justify-center',
            'w-4 h-4',
            'border-2',
            style.border,
            'bg-[var(--bg-primary)]',
            'flex-shrink-0'
          )}
        >
          {checked && (
            <span className={clsx('font-bold text-sm', style.checkColor)}>
              ✓
            </span>
          )}
        </div>

        {/* Label text */}
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          className="hidden"
        />
        <span className="select-none text-[var(--text-primary)] text-sm">
          {label}
        </span>
      </label>
    );
  }
);

ChecklistItem.displayName = 'ChecklistItem';

export default ChecklistItem;
