'use client';

import * as React from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useWidgetBgOverride } from '@/components/widgets/WidgetContainer';
import { hexToRgba } from '@/lib/utils/color';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import { DAYS_SHORT_ARRAY } from '@/lib/constants/days';
import type { CalendarEvent } from '@/types/calendar';
import { useCardCapacity } from '@/lib/hooks/useCardCapacity';
import type { DayBucket } from '@/lib/hooks/useWeekViewData';
import { inlineAllDayEventStyle, inlineTimedEventStyle } from './eventStyles';
import { CardHeightProbe, DayOverflowPopover, DroppableOverlayCell, SpanningEventRows, useDayDroppable, type OverlayItemRef } from './cells';
import { useTimeFormat } from '@/components/providers';
import { eventOccursOnDisplayDay, formatDisplayTime, isCalendarEventPast, toDisplayDate } from '@/lib/utils/timeFormat';
import { eventsOverlappingRange } from '@/lib/utils/calendarRange';

export interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  bordered?: boolean;
  displayMode?: 'inline' | 'cards';
  bucketsByDate?: Map<string, DayBucket>;
  enableDnd?: boolean;
  onItemClick?: (ref: OverlayItemRef) => void;
  /** Show the in-view month band. Full-page calendar already has this title. */
  showMonthHeader?: boolean;
}

/** Fallback when ResizeObserver has not yet measured (~1 frame on mount). */
const FALLBACK_VISIBLE_CARDS = 3;

export function MonthView({
  currentDate,
  events,
  onEventClick,
  onDateClick,
  bordered = true,
  displayMode = 'inline',
  bucketsByDate,
  enableDnd = false,
  onItemClick,
  showMonthHeader = true,
}: MonthViewProps) {
  const { displayTimezone } = useTimeFormat();
  const displayNow = toDisplayDate(new Date(), displayTimezone);
  const cards = displayMode === 'cards';
  const { weekStartsOn } = useWeekStartsOn();
  const [cardHeight, setCardHeight] = React.useState<number | undefined>(undefined);
  const bgOverride = useWidgetBgOverride();
  const transparentMode = bgOverride?.hasCustomBg === true;
  const cellBg = bgOverride?.cellBackgroundColor;
  const cellBgOpacity = bgOverride?.cellBackgroundOpacity ?? 1;
  const cellBgStyle = cellBg ? { backgroundColor: hexToRgba(cellBg, cellBgOpacity) } : undefined;
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const numWeeks = Math.ceil(days.length / 7);
  const dayNames = [...DAYS_SHORT_ARRAY.slice(weekStartsOn), ...DAYS_SHORT_ARRAY.slice(0, weekStartsOn)];
  // Scope the wide event list to this month grid's visible range once, so the
  // shared-lane + per-day filters iterate ~40 events instead of thousands.
  const scopedEvents = eventsOverlappingRange(events, calendarStart, calendarEnd);
  const eventRowEvents = scopedEvents;
  const eventRowEventSet = new Set(eventRowEvents);

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {cards && <CardHeightProbe size="xs" onMeasure={setCardHeight} />}
      {/* Month header — kept compact (py-1, text-sm) so it doesn't eat into
          the calendar grid. The toolbar already shows the month name; this
          band is mostly a colored anchor. */}
      {showMonthHeader && (
        <div className="wall-calendar-month-header shrink-0 text-center py-1 font-semibold text-sm rounded-t-md mb-1 shadow-sm bg-primary text-primary-foreground">
          {format(currentDate, 'MMMM yyyy')}
        </div>
      )}
      <div className="wall-calendar-day-labels shrink-0 grid grid-cols-7 gap-1 mb-1 border-b border-border/70">
        {dayNames.map((name) => (
          <div
            key={name}
            className="text-center text-xs font-medium text-muted-foreground py-1.5"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Auto-scaling calendar grid */}
      <div
        className="wall-calendar-grid flex-1 min-h-0 shrink-0 grid grid-cols-7 gap-1"
        style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(60px, 1fr))` }}
      >
        {days.map((date, index) => {
          const weekStartIndex = Math.floor(index / 7) * 7;
          const rowDates = days.slice(weekStartIndex, weekStartIndex + 7);
          const rowEventEvents = eventRowEvents.filter((event) => rowDates.some((rowDate) =>
            eventOccursOnDisplayDay(
              event.startTime,
              event.endTime,
              event.allDay,
              rowDate,
              displayTimezone,
            )));
          const dayEvents = scopedEvents
            .filter((event) => !eventRowEventSet.has(event))
            .filter((event) => eventOccursOnDisplayDay(
              event.startTime,
              event.endTime,
              event.allDay,
              date,
              displayTimezone,
            ))
            .sort((a, b) => {
              if (a.allDay && !b.allDay) return -1;
              if (!a.allDay && b.allDay) return 1;
              return a.startTime.getTime() - b.startTime.getTime();
            });

          const isPast = isBefore(date, startOfDay(displayNow)) && !isSameDay(date, displayNow);

          return (
            <MonthDayCell
              key={index}
              date={date}
              dayEvents={dayEvents}
              rowDates={rowDates}
              spanningEvents={rowEventEvents}
              bucket={bucketsByDate?.get(format(date, 'yyyy-MM-dd'))}
              cards={cards}
              enableDnd={enableDnd}
              cardHeight={cardHeight}
              currentDate={currentDate}
              isPast={isPast}
              bordered={bordered}
              transparentMode={transparentMode}
              cellBgStyle={cellBgStyle}
              onDateClick={onDateClick}
              onEventClick={onEventClick}
              onItemClick={onItemClick}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * One day cell in the month grid. Lifted out of the parent map so it can
 * register a useDayDroppable target and show the purple drop-hover ring on
 * its outer wrapper (matching /week's DayColumn).
 */
function MonthDayCell({
  date,
  dayEvents,
  rowDates,
  spanningEvents,
  bucket,
  cards,
  enableDnd,
  cardHeight,
  currentDate,
  isPast,
  bordered,
  transparentMode,
  cellBgStyle,
  onDateClick,
  onEventClick,
  onItemClick,
}: {
  date: Date;
  dayEvents: CalendarEvent[];
  rowDates: Date[];
  spanningEvents: CalendarEvent[];
  bucket: DayBucket | undefined;
  cards: boolean;
  enableDnd: boolean;
  cardHeight: number | undefined;
  currentDate: Date;
  isPast: boolean;
  bordered: boolean;
  transparentMode: boolean;
  cellBgStyle: React.CSSProperties | undefined;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onItemClick?: (ref: OverlayItemRef) => void;
}) {
  const { timeFormat, displayTimezone } = useTimeFormat();
  const today = isSameDay(date, toDisplayDate(new Date(), displayTimezone));
  const droppable = useDayDroppable({ date, enabled: cards && enableDnd });

  return (
    <div
      ref={cards && enableDnd ? droppable.setNodeRef : undefined}
      data-droppable-day={cards && enableDnd ? droppable.droppableId : undefined}
      onClick={() => onDateClick(date)}
      className={cn(
        'relative wall-calendar-day-cell',
        (cards || bordered) && 'border border-border',
        'cursor-pointer overflow-visible rounded-md',
        !transparentMode && !cellBgStyle && 'bg-calendar-surface',
        'flex flex-col min-h-0',
        !isSameMonth(date, currentDate) && 'text-muted-foreground',
        !transparentMode && !cellBgStyle && isPast && isSameMonth(date, currentDate) && 'bg-muted/65 text-muted-foreground',
        !transparentMode && !cellBgStyle && today && 'bg-calendar-today',
        today && !(cards && enableDnd && droppable.isOver) && 'ring-2 ring-inset ring-ring',
        cards && enableDnd && droppable.isOver && 'ring-2 ring-seasonal-accent shadow-lg',
      )}
      style={cellBgStyle}
    >
      <div className="px-1 pt-1 mb-0.5">
        <span className={cn('wall-calendar-day-number text-sm font-medium', today && 'font-bold text-foreground')}>
          {format(date, 'd')}
        </span>
      </div>

      <SpanningEventRows
        date={date}
        rowDates={rowDates}
        events={spanningEvents}
        onEventClick={onEventClick}
      />

      {cards ? (
        <DayCardsCell
          date={date}
          events={dayEvents}
          bucket={bucket}
          enableDnd={enableDnd}
          cardHeight={cardHeight}
          onEventClick={onEventClick}
          onItemClick={onItemClick}
        />
      ) : (
        <ul className="flex-1 overflow-y-auto space-y-0.5 list-none m-0 px-1 pb-1 pt-0">
          {dayEvents.map((event) => (
            <li
              key={event.id}
              onClick={(e) => {
                e.stopPropagation();
                onEventClick(event);
              }}
              className={cn(
                'wall-inline-event-card flex items-center text-xs px-2 rounded truncate cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-seasonal-accent/50 transition-all',
                event.allDay ? 'py-px' : 'py-0.5'
              )}
              style={event.allDay
                ? inlineAllDayEventStyle(event.color)
                : inlineTimedEventStyle(event.color)
              }
            >
              {event.allDay ? event.title : `• ${formatDisplayTime(event.startTime, timeFormat, {}, displayTimezone)} ${event.title}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Renders the events portion of a month-view cell in cards mode. Uses
 * useCardCapacity to fit as many cards as the available cell height allows,
 * falling back to {@link FALLBACK_VISIBLE_CARDS} for the first frame before
 * the ResizeObserver fires.
 */
function DayCardsCell({
  date,
  events,
  bucket,
  enableDnd,
  cardHeight,
  onEventClick,
  onItemClick,
}: {
  date: Date;
  events: CalendarEvent[];
  bucket: DayBucket | undefined;
  enableDnd: boolean;
  cardHeight: number | undefined;
  onEventClick: (event: CalendarEvent) => void;
  onItemClick?: (ref: OverlayItemRef) => void;
}) {
  const { displayTimezone } = useTimeFormat();
  const overlayItemCount = bucket ? bucket.meals.length + bucket.chores.length + bucket.tasks.length : 0;
  // Reserve ~22px for the popover trigger; each overlay row is ~24px (sm card)
  // plus the cell's 4px gap-1 separator. 20px under-reserved enough that event
  // rows pushed overlay items into clipped territory on dense days.
  const popoverHeight = 28 + overlayItemCount * 26;

  const { cellRef, fitWithOverflow, fitWithoutOverflow } = useCardCapacity({
    cardHeight,
    popoverHeight,
  });

  const fallback = FALLBACK_VISIBLE_CARDS;
  const noOverflowFit = fitWithoutOverflow ?? fallback;
  const overflowFit = fitWithOverflow ?? fallback;

  // If every event fits without a popover, show all. Otherwise reserve the
  // last visible slot for the popover trigger so overflow is always explicit
  // and never clipped by the cell's overflow:hidden.
  let visibleCount: number;
  if (events.length <= noOverflowFit) {
    visibleCount = events.length;
  } else {
    visibleCount = overflowFit;
  }

  const visible = events.slice(0, Math.max(0, visibleCount));
  const hidden = events.slice(visible.length);

  return (
    <div
      ref={cellRef}
      className="flex-1 min-h-0 flex flex-col gap-0.5 px-1 pb-1"
    >
      {visible.map((event) => (
        <button
          key={event.id}
          onClick={(e) => {
            e.stopPropagation();
            onEventClick(event);
          }}
          className={cn(
            'wall-month-event-card flex w-full items-center text-left border-border bg-calendar-surface text-[12px] px-2 py-0.5 rounded border shadow-sm truncate hover:bg-accent transition-colors leading-tight',
            isCalendarEventPast(
              event.startTime,
              event.endTime,
              event.allDay,
              new Date(),
              displayTimezone,
            ) && 'opacity-55 saturate-[0.65]',
          )}
          style={{ borderLeft: `3px solid ${event.color}`, '--wall-event-color': event.color } as React.CSSProperties}
        >
          <span className="font-medium text-foreground">{event.title}</span>
        </button>
      ))}
      {hidden.length > 0 && (
        <div onClick={(e) => e.stopPropagation()}>
          <DayOverflowPopover date={date} hiddenEvents={hidden} onEventClick={onEventClick} />
        </div>
      )}
      {/* Meals/chores/tasks overlay floats to the bottom of the cell, inside a
          faint theme-aware band (when populated) that delineates it from events. */}
      {bucket && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'mt-auto',
            overlayItemCount > 0 && 'rounded-md bg-muted/60 px-1.5 py-1 ring-1 ring-border/50',
          )}
        >
          <DroppableOverlayCell
            date={date}
            bucket={bucket}
            size="xs"
            layout="row"
            enableDnd={enableDnd}
            onItemClick={onItemClick}
          />
        </div>
      )}
    </div>
  );
}
