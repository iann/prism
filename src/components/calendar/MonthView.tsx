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
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useWidgetBgOverride } from '@/components/widgets/WidgetContainer';
import { hexToRgba } from '@/lib/utils/color';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import { DAYS_SHORT_ARRAY } from '@/lib/constants/days';
import type { CalendarEvent } from '@/types/calendar';
import {
  CardHeightProbe,
  DayOverflowPopover,
  DroppableOverlayCell,
  useDayDroppable,
  type OverlayItemRef,
} from './cells';
import { useCardCapacity } from '@/lib/hooks/useCardCapacity';
import type { DayBucket } from '@/lib/hooks/useWeekViewData';
import { WallEventCard } from '@/components/wall';

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
}: MonthViewProps) {
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
  const dayNames = [
    ...DAYS_SHORT_ARRAY.slice(weekStartsOn),
    ...DAYS_SHORT_ARRAY.slice(0, weekStartsOn),
  ];

  return (
    <div className="wall-month-view flex h-full flex-col overflow-auto">
      {cards && <CardHeightProbe size="xs" onMeasure={setCardHeight} />}
      <div className="wall-calendar-grid mb-1 grid shrink-0 grid-cols-7">
        {dayNames.map((name) => (
          <div key={name} className="wall-calendar-day-label text-center">
            {name}
          </div>
        ))}
      </div>

      {/* Auto-scaling calendar grid */}
      <div
        className="wall-calendar-grid grid flex-1 shrink-0 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(60px, 1fr))` }}
      >
        {days.map((date, index) => {
          const dayStart = startOfDay(date);
          const dayEvents = events
            .filter((event) =>
              event.allDay
                ? event.startTime <= dayStart && event.endTime > dayStart
                : isSameDay(event.startTime, date)
            )
            .sort((a, b) => {
              if (a.allDay && !b.allDay) return -1;
              if (!a.allDay && b.allDay) return 1;
              return a.startTime.getTime() - b.startTime.getTime();
            });

          const isPast = isBefore(date, startOfDay(new Date())) && !isToday(date);

          return (
            <MonthDayCell
              key={index}
              date={date}
              dayEvents={dayEvents}
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
  const droppable = useDayDroppable({ date, enabled: cards && enableDnd });

  return (
    <div
      ref={cards && enableDnd ? droppable.setNodeRef : undefined}
      data-droppable-day={cards && enableDnd ? droppable.droppableId : undefined}
      onClick={() => onDateClick(date)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onDateClick(date);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${format(date, 'EEEE, MMMM d')}`}
      className={cn(
        (cards || bordered) && 'border border-border',
        'cursor-pointer overflow-hidden rounded-md',
        !transparentMode && !cellBgStyle && 'bg-calendar-surface',
        'flex min-h-0 flex-col',
        !isSameMonth(date, currentDate) && 'text-muted-foreground',
        !transparentMode &&
          !cellBgStyle &&
          isPast &&
          isSameMonth(date, currentDate) &&
          'bg-muted/65 text-muted-foreground',
        !transparentMode && !cellBgStyle && isToday(date) && 'bg-calendar-today',
        isToday(date) && !(cards && enableDnd && droppable.isOver) && 'ring-2 ring-inset ring-ring',
        cards && enableDnd && droppable.isOver && 'shadow-lg ring-2 ring-seasonal-accent'
      )}
      style={cellBgStyle}
    >
      <div className="mb-0.5 px-2 pt-2">
        <span
          className={cn('text-base font-semibold', isToday(date) && 'font-bold text-foreground')}
        >
          {format(date, 'd')}
        </span>
      </div>

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
        <ul className="m-0 flex-1 list-none space-y-0.5 overflow-y-auto px-1 pb-1 pt-0">
          {dayEvents.map((event) => (
            <li
              key={event.id}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onEventClick(event);
              }}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                  keyboardEvent.preventDefault();
                  keyboardEvent.stopPropagation();
                  onEventClick(event);
                }
              }}
              aria-label={`Open event: ${event.title}`}
              className="cursor-pointer truncate transition-all hover:opacity-85"
            >
              <WallEventCard
                color={event.color}
                density="compact"
                className="text-[13px] leading-snug"
              >
                {event.allDay ? event.title : `${format(event.startTime, 'h:mm a')} ${event.title}`}
              </WallEventCard>
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
  const overlayItemCount = bucket
    ? bucket.meals.length + bucket.chores.length + bucket.tasks.length
    : 0;
  // Reserve ~22px for the popover trigger; each overlay row is ~24px (sm card)
  // plus the cell's 4px gap-1 separator. 20px under-reserved enough that event
  // rows pushed overlay items into clipped territory on dense days.
  const popoverHeight = 22 + overlayItemCount * 26;

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
    <div ref={cellRef} className="flex min-h-0 flex-1 flex-col gap-1 px-2 pb-2">
      {visible.map((event) => (
        <WallEventCard key={event.id} color={event.color} density="compact" className="w-full">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEventClick(event);
            }}
            className="w-full truncate text-left text-[13px] font-semibold leading-snug text-foreground"
          >
            {event.title}
          </button>
        </WallEventCard>
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
            overlayItemCount > 0 && 'rounded-md bg-muted/60 px-1.5 py-1 ring-1 ring-border/50'
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
