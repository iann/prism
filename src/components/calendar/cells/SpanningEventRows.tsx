'use client';

import { addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { contrastText } from '@/lib/utils/color';
import type { CalendarEvent } from '@/types/calendar';
import { useTimeFormat } from '@/components/providers';
import { inlineTimedEventStyle } from '../eventStyles';
import {
  eventOccursOnDisplayDay,
  eventSpansMultipleDisplayDays,
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
  /**
   * The column gap this row's cells are laid out with, as a CSS length.
   *
   * A continuing slice widens by exactly this much so it meets the next day's
   * slice across the gap. Required, not defaulted: a default silently
   * disagreed with MonthView's `gap-px` for as long as it existed, widening
   * every continuing bar by 3px more than the gap it was bridging, so bars
   * bled into the neighbouring day. A caller that knows its grid should have
   * to say so.
   */
  gap: string;
};

/**
 * Renders one shared lane for each group of overlapping calendar events. A
 * continuing slice covers only the gap after its own cell. Adjacent slices
 * therefore meet without overlapping, which keeps translucent/muted bars from
 * producing darker seams at day boundaries.
 *
 * All visible events share this layout, including timed one-day events. Keeping
 * them in the same lane layout prevents a one-day event from being pushed below
 * every spanning event in the week.
 */
export function SpanningEventRows({
  date,
  rowDates,
  events,
  onEventClick,
  compact = false,
  gap,
}: SpanningEventRowsProps) {
  const { timeFormat, displayTimezone } = useTimeFormat();
  const column = rowDates.findIndex((candidate) => isSameDay(candidate, date));
  if (column < 0 || events.length === 0) return null;

  const occurs = (event: CalendarEvent, target: Date) =>
    eventOccursOnDisplayDay(event.startTime, event.endTime, event.allDay, target, displayTimezone);
  // Personal wall-display readability contract: compact labels stay at the
  // measured h-5 row scale even while the upstream lane packing is used.
  const rowHeight = 'h-5';

  // Which lane each span sits in, packed rather than taken from its position
  // in the row's list.
  //
  // A span has to keep one lane for every day it covers, so its slices line up
  // across the week. But a span may reuse a lane that an earlier span has
  // already finished with. Using list position instead means a span starting
  // on Monday sits in lane 3 all week merely because three others began before
  // it and ended before it started, leaving three blank rows above it on every
  // day it covers.
  //
  // Greedy over spans in start order, lowest free lane each time, which is the
  // standard packing for intervals and is optimal in lane count. Every cell in
  // the row computes the same assignment from the same inputs, so the lanes
  // agree across days without the cells having to share state.
  const ordered = [...events].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime() || a.id.localeCompare(b.id),
  );
  const occupancy: boolean[][] = [];
  const laneOf = new Map<string, number>();
  for (const event of ordered) {
    const covers = rowDates.map((rowDate) => occurs(event, rowDate));
    let lane = 0;
    for (;; lane += 1) {
      if (!occupancy[lane]) occupancy[lane] = rowDates.map(() => false);
      if (!covers.some((covered, i) => covered && occupancy[lane]![i])) break;
    }
    covers.forEach((covered, i) => {
      if (covered) occupancy[lane]![i] = true;
    });
    laneOf.set(event.id, lane);
  }

  // What this day draws, by lane. A blank lane still holds a bar's position
  // steady, but only when a bar is drawn BELOW it here, so trailing blanks go
  // and a day the row's spans all miss renders nothing at all.
  const byLane: Array<CalendarEvent | null> = Array.from({ length: occupancy.length }, () => null);
  for (const event of ordered) {
    if (occurs(event, date)) byLane[laneOf.get(event.id)!] = event;
  }
  let lastActiveLane = -1;
  byLane.forEach((event, lane) => {
    if (event) lastActiveLane = lane;
  });
  if (lastActiveLane < 0) return null;

  return (
    <div
      data-spanning-events
      className={cn('relative z-20 flex shrink-0 flex-col', compact ? 'gap-px' : 'gap-0.5')}
    >
      {byLane.slice(0, lastActiveLane + 1).map((laneEvent, lane) => {
        // An empty lane below an occupied one: holds the lane open so the bar
        // under it keeps the same height on every day it spans.
        if (!laneEvent) return <div key={`lane-${lane}`} aria-hidden className={rowHeight} />;

        const event = laneEvent;
        const continuesFromPrevious = occurs(event, addDays(date, -1));
        const continuesToNext = occurs(event, addDays(date, 1));
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
        const filledEvent = event.allDay || eventSpansMultipleDisplayDays(
          event.startTime,
          event.endTime,
          false,
          displayTimezone,
        );

        return (
          <button
            key={`${event.id}-${lane}`}
            type="button"
            data-event-row={lane}
            title={label}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onEventClick(event);
            }}
            className={cn(
              'relative z-20 flex w-full items-center truncate text-left font-medium leading-tight hover:brightness-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seasonal-accent',
              rowHeight,
              compact ? 'px-1' : 'px-2',
              'text-xs',
              !continuesFromPrevious && 'rounded-l-md',
              !continuesToNext && 'rounded-r-md',
              continuesBeforeRow && 'pl-2',
              continuesAfterRow && 'pr-2',
              past && 'opacity-55 saturate-[0.65]'
            )}
            style={{
              ...(filledEvent
                ? { backgroundColor: event.color, color: past ? contrastText(event.color) : '#fff' }
                : inlineTimedEventStyle(event.color)),
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
            {(!continuesFromPrevious || column === 0) && (
              <span className="min-w-0 truncate">{label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
