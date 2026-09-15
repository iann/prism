'use client';

import { cn } from '@/lib/utils';
import { TAG_PRESETS } from '../constants';

interface TagChipProps {
  tag: string;
  active?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
  wallFilter?: boolean;
}

export function TagChip({ tag, active, onClick, size = 'md', wallFilter = false }: TagChipProps) {
  const preset = TAG_PRESETS.find((t) => t.value === tag);
  const label = preset ? `${preset.emoji} ${preset.label}` : tag;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full border transition-colors',
        wallFilter ? 'wall-filter-control' : size === 'sm' ? 'px-1.5 py-0 text-[12px]' : 'px-2 py-0.5 text-xs',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : onClick
          ? 'bg-muted text-muted-foreground border-transparent hover:bg-accent hover:text-foreground'
          : 'bg-muted/60 text-muted-foreground border-transparent cursor-default'
      )}
    >
      {label}
    </button>
  );
}
