'use client';

import * as React from 'react';
import { ChevronIcon } from './LayoutEditorIcons';

export function PopoverButton({
  label,
  isActive,
  onToggle,
  children,
  width,
  align = 'left',
}: {
  label: React.ReactNode;
  isActive: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  width?: number;
  align?: 'left' | 'right';
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors active:scale-[0.98] ${
          isActive ? 'bg-accent text-accent-foreground' : 'bg-muted hover:bg-accent'
        }`}
      >
        {label}
        <ChevronIcon open={isActive} />
      </button>
      {isActive && (
        <div
          className="absolute top-full z-50 mt-1 rounded-md border border-border bg-popover shadow-lg"
          style={{
            width: width ?? 'auto',
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
