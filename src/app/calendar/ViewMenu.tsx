'use client';

import * as React from 'react';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Grid3X3,
  LayoutGrid,
  List,
  ListChecks,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type ViewType =
  | 'agenda'
  | 'day'
  | 'week'
  | 'weekVertical'
  | 'multiWeek'
  | 'month'
  | 'threeMonth';

export type MultiWeekCount = 1 | 2 | 3 | 4;

interface ViewMenuProps {
  viewType: ViewType;
  weekCount: MultiWeekCount;
  onViewChange: (viewType: ViewType) => void;
  onWeekCountChange: (n: MultiWeekCount) => void;
}

interface ViewOption {
  /** Label shown in trigger AND menu. */
  label: string;
  /** Icon shown alongside the label. */
  Icon: typeof Calendar;
  /** Returns true when this option matches the current view state. */
  isActive: (viewType: ViewType, weekCount: MultiWeekCount) => boolean;
  /** Switches the calendar to this option. */
  apply: (setView: (v: ViewType) => void, setWeekCount: (n: MultiWeekCount) => void) => void;
}

const OPTIONS: ViewOption[] = [
  {
    label: 'Agenda',
    Icon: ListChecks,
    isActive: (v) => v === 'agenda',
    apply: (setView) => setView('agenda'),
  },
  {
    label: 'Day',
    Icon: CalendarDays,
    isActive: (v) => v === 'day',
    apply: (setView) => setView('day'),
  },
  {
    label: 'Day list',
    Icon: List,
    isActive: (v) => v === 'weekVertical',
    apply: (setView) => setView('weekVertical'),
  },
  {
    label: 'Week timeline',
    Icon: Clock,
    isActive: (v) => v === 'week',
    apply: (setView) => setView('week'),
  },
  {
    label: '1 Week',
    Icon: CalendarRange,
    isActive: (v, wc) => v === 'multiWeek' && wc === 1,
    apply: (setView, setWeekCount) => {
      setView('multiWeek');
      setWeekCount(1);
    },
  },
  {
    label: '2 Weeks',
    Icon: CalendarRange,
    isActive: (v, wc) => v === 'multiWeek' && wc === 2,
    apply: (setView, setWeekCount) => {
      setView('multiWeek');
      setWeekCount(2);
    },
  },
  {
    label: '3 Weeks',
    Icon: CalendarRange,
    isActive: (v, wc) => v === 'multiWeek' && wc === 3,
    apply: (setView, setWeekCount) => {
      setView('multiWeek');
      setWeekCount(3);
    },
  },
  {
    label: '4 Weeks',
    Icon: CalendarRange,
    isActive: (v, wc) => v === 'multiWeek' && wc === 4,
    apply: (setView, setWeekCount) => {
      setView('multiWeek');
      setWeekCount(4);
    },
  },
  {
    label: 'Month',
    Icon: LayoutGrid,
    isActive: (v) => v === 'month',
    apply: (setView) => setView('month'),
  },
  {
    label: '3 Months',
    Icon: Grid3X3,
    isActive: (v) => v === 'threeMonth',
    apply: (setView) => setView('threeMonth'),
  },
];

export function ViewMenu({ viewType, weekCount, onViewChange, onWeekCountChange }: ViewMenuProps) {
  const [open, setOpen] = React.useState(false);
  const activeIndex = Math.max(
    0,
    OPTIONS.findIndex((o) => o.isActive(viewType, weekCount))
  );
  const active = OPTIONS[activeIndex] ?? OPTIONS[0]!;
  const ActiveIcon = active.Icon;

  // Cycle through OPTIONS with wraparound. These are intentionally separate
  // touch targets: a wall display should never ask someone to hit a desktop-
  // sized spinner arrow.
  const cycle = (delta: -1 | 1) => {
    const next = (activeIndex + delta + OPTIONS.length) % OPTIONS.length;
    OPTIONS[next]!.apply(onViewChange, onWeekCountChange);
  };

  return (
    <div className="wall-view-menu inline-flex h-[52px] items-stretch gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="wall-view-trigger h-full w-32 justify-center gap-1.5"
          >
            <ActiveIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{active.label}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="wall-popover-content wall-view-picker-popover w-44 p-1"
        >
          {OPTIONS.map((opt) => {
            const Icon = opt.Icon;
            const isActive = opt.isActive(viewType, weekCount);
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  opt.apply(onViewChange, onWeekCountChange);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                  'transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive ? 'bg-accent/60 font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{opt.label}</span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
      <button
        type="button"
        aria-label="Previous calendar view"
        title="Previous calendar view"
        onClick={() => cycle(-1)}
        className="wall-view-cycle inline-flex h-full w-11 items-center justify-center text-foreground/80 transition-colors hover:bg-accent hover:text-foreground active:scale-[0.97]"
      >
        <ChevronUp className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Next calendar view"
        title="Next calendar view"
        onClick={() => cycle(1)}
        className="wall-view-cycle inline-flex h-full w-11 items-center justify-center text-foreground/80 transition-colors hover:bg-accent hover:text-foreground active:scale-[0.97]"
      >
        <ChevronDown className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
