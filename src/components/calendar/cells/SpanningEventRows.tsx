'use client';

import { addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { contrastText } from '@/lib/utils/color';
import type { CalendarEvent } from '@/types/calendar';
import { useTimeFormat } from '@/components/providers';
import { layoutCalendarEventRows } from '@/lib/utils/calendarEventRows';
import {
  eventOccursOnDisplayDay,
  eventStartsOnDisplayDay,
  formatDisplayTime,
  isCalendarEventPast,
} from '@/lib/utils/timeFormat';

export type SpanningEventRowsProps = {
  date: Date;
  rowDates: Date[];
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  compact?: boolean;
  gap?: string;
};

/**
 * Renders one shared lane for each group of overlapping all-day or multi-day
 * events. A continuing slice covers only the gap after its own cell. Adjacent
 * slices therefore meet without overlapping, which keeps translucent/muted
 * bars from producing darker seams at day boundaries.
 *
 * `events` includes one-day all-day events as well as events that span display
 * days. Keeping them in the same lane layout prevents a one-day event from
 * being pushed below every spanning event in the week.
 */
export function SpanningEventRows({
  date,
  rowDates,
  events,
  onEventClick,
  compact = false,
  gap = '0.25rem',
}: SpanningEventRowsProps) {
  const { timeFormat, displayTimezone } = useTimeFormat();
  const column = rowDates.findIndex((candidate) => isSameDay(candidate, date));
  if (column < 0 || events.length === 0) return null;

  const occurs = (event: CalendarEvent, target: Date) =>
    eventOccursOnDisplayDay(event.startTime, event.endTime, event.allDay, target, displayTimezone);
  const eventRows = layoutCalendarEventRows(events, rowDates, displayTimezone);
  const rowHeight = 'h-5';

  return (
    <div
      data-spanning-events
      className={cn('relative z-20 flex shrink-0 flex-col', compact ? 'gap-px' : 'gap-0.5')}
    >
      {eventRows.map((row, rowIndex) => {
        const event = row.find((candidate) => occurs(candidate, date));
        if (!event) {
          return <div key={`empty-${rowIndex}`} data-event-row={rowIndex} aria-hidden className={rowHeight} />;
        }

        const active = occurs(event, date);
        const continuesFromPrevious = active && occurs(event, addDays(date, -1));
        const continuesToNext = active && occurs(event, addDays(date, 1));
        const continuesWithinRow = continuesToNext && column < rowDates.length - 1;
        const continuesBeforeRow = continuesFromPrevious && column === 0;
        const continuesAfterRow = continuesToNext && column === rowDates.length - 1;
        const past = isCalendarEventPast(
          event.startTime,
          event.endTime,
          event.allDay,
          new Date(),
          displayTimezone
        );

        const startsToday = eventStartsOnDisplayDay(
          event.startTime,
          event.allDay,
          date,
          displayTimezone,
        );
        const label = !event.allDay && startsToday
          ? `${formatDisplayTime(event.startTime, timeFormat, {}, displayTimezone)} ${event.title}`
          : event.title;

        return (
          <button
            key={`${event.id}-${rowIndex}`}
            type="button"
            data-event-row={rowIndex}
            title={label}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onEventClick(event);
            }}
            className={cn(
              'relative z-20 block w-full truncate text-left font-medium leading-tight hover:brightness-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seasonal-accent',
              rowHeight,
              compact ? 'px-0.5' : 'px-1',
              'text-xs',
              !continuesFromPrevious && 'rounded-l-md',
              !continuesToNext && 'rounded-r-md',
              continuesBeforeRow && (compact ? 'pl-1.5' : 'pl-2'),
              continuesAfterRow && (compact ? 'pr-1.5' : 'pr-2'),
              past && 'opacity-55 saturate-[0.65]'
            )}
            style={{
              backgroundColor: event.color,
              color: past ? contrastText(event.color) : '#fff',
              width: continuesWithinRow ? `calc(100% + ${gap})` : '100%',
              clipPath:
                continuesBeforeRow && continuesAfterRow
                  ? 'polygon(0 50%, 6px 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 6px 100%)'
                  : continuesBeforeRow
                    ? 'polygon(0 50%, 6px 0, 100% 0, 100% 100%, 6px 100%)'
                    : continuesAfterRow
                      ? 'polygon(0 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 0 100%)'
                      : undefined,
            }}
          >
            {(!continuesFromPrevious || column === 0) && label}
          </button>
        );
      })}
    </div>
  );
}
