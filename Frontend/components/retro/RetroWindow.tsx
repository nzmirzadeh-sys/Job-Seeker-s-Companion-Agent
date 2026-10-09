'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';

interface RetroWindowProps {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  defaultMinimized?: boolean;
  className?: string;
  menu?: { title: string }[];
  contentClassName?: string;
}

const RetroWindow = React.forwardRef<HTMLDivElement, RetroWindowProps>(
  (
    {
      title,
      children,
      onClose,
      onMinimize,
      onMaximize,
      defaultMinimized = false,
      className,
      menu,
      contentClassName,
    },
    ref
  ) => {
    const [isMinimized, setIsMinimized] = useState(defaultMinimized);

    const handleMinimize = () => {
      setIsMinimized(!isMinimized);
      onMinimize?.();
    };

    return (
      <div
        ref={ref}
        className={clsx(
          'retro-window',
          'flex flex-col',
          'max-w-full',
          className
        )}
      >
        {/* Title Bar */}
        <div className="retro-window-title">
          <span className="flex-1 text-right pr-2">{title}</span>
          <div className="retro-window-controls">
            {onMinimize && (
              <button
                onClick={handleMinimize}
                className="retro-window-button"
                title="کاهش‌یافتن"
                aria-label="کاهش‌یافتن"
              >
                _
              </button>
            )}
            {onMaximize && (
              <button
                onClick={onMaximize}
                className="retro-window-button"
                title="بیشینه‌سازی"
                aria-label="بیشینه‌سازی"
              >
                □
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="retro-window-button"
                title="بستن"
                aria-label="بستن"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Menu Bar */}
        {!isMinimized && menu && menu.length > 0 && (
          <div
            className="flex items-center gap-0 px-2 py-1 text-[11px] border-b-2"
            style={{
              backgroundColor: '#F5F0E1',
              borderBottomColor: '#141311',
              color: '#141311',
            }}
          >
            {menu.map((m) => (
              <span
                key={m.title}
                className="px-2 py-0.5 cursor-pointer select-none hover:opacity-70"
              >
                {m.title}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        {!isMinimized && (
          <div
            className={clsx(
              'p-3 overflow-auto flex-1',
              contentClassName
            )}
          >
            {children}
          </div>
        )}
      </div>
    );
  }
);

RetroWindow.displayName = 'RetroWindow';

export default RetroWindow;
