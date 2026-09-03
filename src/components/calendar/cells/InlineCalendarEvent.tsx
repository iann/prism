'use client';

import { cn } from '@/lib/utils';
import { contrastText } from '@/lib/utils/color';
import type { CalendarEvent } from '@/types/calendar';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTime, isCalendarEventPast } from '@/lib/utils/timeFormat';

export type InlineCalendarEventProps = {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
  compact?: boolean;
  showTime?: boolean;
  className?: string;
};

/** Shared filled-chip / timed-dot treatment for compact calendar views. */
export function InlineCalendarEvent({
  event,
  onClick,
  compact = false,
  showTime = true,
  className,
}: InlineCalendarEventProps) {
  const { timeFormat, displayTimezone } = useTimeFormat();
  const past = isCalendarEventPast(
    event.startTime,
    event.endTime,
    event.allDay,
    new Date(),
    displayTimezone
  );
  const time =
    showTime && !event.allDay
      ? formatDisplayTime(event.startTime, timeFormat, {}, displayTimezone)
      : null;

  return (
    <button
      type="button"
      title={event.title}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick(event);
      }}
      className={cn(
        'flex w-full min-w-0 items-center truncate rounded text-left font-medium transition-[background-color,filter,opacity]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seasonal-accent',
        compact ? 'px-1 py-px' : 'px-2 py-0.5',
        'text-xs leading-tight',
        event.allDay ? 'hover:brightness-95' : 'gap-1 hover:bg-accent/60',
        past && 'opacity-55 saturate-[0.65]',
        className
      )}
      style={
        event.allDay
          ? { backgroundColor: event.color, color: past ? contrastText(event.color) : '#fff' }
          : undefined
      }
    >
      {event.allDay ? (
        event.title
      ) : (
        <>
          <span
            aria-hidden
            className={cn('shrink-0 rounded-full', compact ? 'h-1 w-1' : 'h-1.5 w-1.5')}
            style={{ backgroundColor: event.color }}
          />
          {time && <span className="shrink-0 tabular-nums text-muted-foreground">{time}</span>}
          <span className="truncate text-foreground">{event.title}</span>
        </>
      )}
    </button>
  );
}
