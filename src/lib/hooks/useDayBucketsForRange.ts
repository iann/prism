'use client';

import { useCallback, useMemo } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { useCalendarEvents } from './useCalendarEvents';
import { useMeals } from './useMeals';
import { useChores } from './useChores';
import { useTasks } from './useTasks';
import { useWeather } from './useWeather';
import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/constants/days';
import type { CalendarEvent } from '@/types/calendar';
import type { Chore, Meal, Task } from '@/types';
import type { WeatherData } from '@/components/widgets/WeatherWidget';
import type { DayBucket } from './useWeekViewData';
import { useTimeFormat } from '@/components/providers';
import { eventOccursOnDisplayDay } from '@/lib/utils/timeFormat';

export interface OverlayFlags {
  events: boolean;
  meals: boolean;
  chores: boolean;
  tasks: boolean;
}

interface UseDayBucketsForRangeOptions {
  /** Inclusive start date (date-only; time ignored) */
  from: Date;
  /** Inclusive end date (date-only; time ignored) */
  to: Date;
  /** Streams to fetch. Disabled streams are skipped to save polling overhead. */
  overlays: OverlayFlags;
  /** Pre-fetched events from the parent — when provided, skip the events fetch and use these. */
  externalEvents?: CalendarEvent[];
  /** Pre-fetched overlay streams from the parent dashboard. */
  externalMeals?: Meal[];
  externalChores?: Chore[];
  externalTasks?: Task[];
  externalWeather?: WeatherData | null;
  /** Refresh callbacks for externally owned streams. */
  refreshMeals?: () => Promise<void>;
  refreshChores?: () => Promise<void>;
  refreshTasks?: () => Promise<void>;
}

interface UseDayBucketsForRangeResult {
  bucketsByDate: Map<string, DayBucket>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Chronological order matching MEAL_TIME_DEFAULTS in cells/itemTime.ts
// (07:00 → 12:00 → 15:00 → 18:00) and CalendarView.tsx's sortMealsByType.
// Keep these in sync — CalendarWidget passes bucketsByDate straight to its
// views without re-sorting, so the order from this hook is what users see.
const MEAL_TYPE_ORDER: Record<Meal['mealType'], number> = {
  breakfast: 0,
  lunch: 1,
  snack: 2,
  dinner: 3,
};

const EMPTY_EVENTS: CalendarEvent[] = [];
const EMPTY_MEALS: Meal[] = [];
const EMPTY_CHORES: Chore[] = [];
const EMPTY_TASKS: Task[] = [];
const TASK_PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function eventOnDay(event: CalendarEvent, day: Date, displayTimezone: string): boolean {
  return eventOccursOnDisplayDay(
    event.startTime,
    event.endTime,
    event.allDay,
    day,
    displayTimezone,
  );
}

function choreDateKey(chore: Chore): string | null {
  if (!chore.nextDue) return null;
  // chore.nextDue is a YYYY-MM-DD DATE column; parse as local to avoid the
  // UTC-shift bug that would otherwise put the chore on the previous day.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(chore.nextDue);
  if (!m) return null;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(due.getTime())) return null;
  return dateKey(due);
}

/**
 * Returns a Map keyed by `yyyy-MM-dd` of DayBucket objects covering the range
 * [from, to] inclusive. Streams disabled in `overlays` are not fetched.
 *
 * Meals are loaded without a weekOf filter (the API caches the full set), so
 * cross-week ranges (month / multi-week / agenda) all see meals correctly.
 */
export function useDayBucketsForRange({
  from,
  to,
  overlays,
  externalEvents,
  externalMeals,
  externalChores,
  externalTasks,
  externalWeather,
  refreshMeals: refreshExternalMeals,
  refreshChores: refreshExternalChores,
  refreshTasks: refreshExternalTasks,
}: UseDayBucketsForRangeOptions): UseDayBucketsForRangeResult {
  const { displayTimezone } = useTimeFormat();
  const fromKey = useMemo(() => dateKey(from), [from]);
  const toKey = useMemo(() => dateKey(to), [to]);
  const hasExternalMeals = externalMeals !== undefined;
  const hasExternalChores = externalChores !== undefined;
  const hasExternalTasks = externalTasks !== undefined;
  const hasExternalWeather = externalWeather !== undefined;

  // Use external events when provided (CalendarView already fetches events
  // with its own filter set). Otherwise fetch internally.
  const fetchEvents = externalEvents === undefined && overlays.events;
  const {
    events: ownEvents,
    loading: eventsLoading,
    error: eventsError,
    refresh: refreshEvents,
  } = useCalendarEvents({ daysToShow: 60, enabled: fetchEvents });

  const events = externalEvents ?? (fetchEvents ? ownEvents : EMPTY_EVENTS);

  const {
    meals,
    loading: mealsLoading,
    error: mealsError,
    refresh: refreshMeals,
  } = useMeals({ enabled: !hasExternalMeals && overlays.meals });

  const {
    chores,
    loading: choresLoading,
    error: choresError,
    refresh: refreshChores,
  } = useChores({
    enabled: !hasExternalChores && overlays.chores,
    includeFuture: true,
  });

  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    refresh: refreshTasks,
  // showCompleted: true — completed tasks render muted/strikethrough via
  // OverlayItemsCell's muted={task.completed} → WeekItemCard styling, matching
  // how cooked meals stay visible. Hiding them outright was a usability gap
  // (a task you completed today disappears entirely from the calendar).
  } = useTasks({
    showCompleted: true,
    enabled: !hasExternalTasks && overlays.tasks,
  });

  const { data: ownWeather } = useWeather({ enabled: !hasExternalWeather });

  const resolvedMeals = hasExternalMeals ? externalMeals! : (overlays.meals ? meals : EMPTY_MEALS);
  const resolvedChores = hasExternalChores ? externalChores! : (overlays.chores ? chores : EMPTY_CHORES);
  const resolvedTasks = hasExternalTasks ? externalTasks! : (overlays.tasks ? tasks : EMPTY_TASKS);
  const weather = hasExternalWeather ? externalWeather : ownWeather;

  const bucketsByDate = useMemo<Map<string, DayBucket>>(() => {
    const map = new Map<string, DayBucket>();
    const start = startOfDay(from);
    const end = startOfDay(to);

    // Pre-filter events that overlap the requested range (with a timezone
    // safety pad), then index each event by the displayed day it occupies.
    // This keeps the calendar's range work bounded while honoring the selected
    // display timezone for timed and all-day events.
    const DAY_MS = 86_400_000;
    const filterStartMs = start.getTime() - DAY_MS;
    const filterEndMs = end.getTime() + 2 * DAY_MS;
    const rangeEvents = overlays.events
      ? events.filter(
          (event) => event.startTime.getTime() <= filterEndMs && event.endTime.getTime() >= filterStartMs,
        )
      : EMPTY_EVENTS;

    const eventsByDate = new Map<string, CalendarEvent[]>();
    if (overlays.events) {
      let eventDay = start;
      while (eventDay <= end) {
        const key = dateKey(eventDay);
        for (const event of rangeEvents) {
          if (!eventOnDay(event, eventDay, displayTimezone)) continue;
          const bucket = eventsByDate.get(key);
          if (bucket) bucket.push(event);
          else eventsByDate.set(key, [event]);
        }
        eventDay = addDays(eventDay, 1);
      }
    }

    const mealsByDay = new Map<DayOfWeek, Meal[]>();
    if (overlays.meals) {
      for (const meal of resolvedMeals) {
        const bucket = mealsByDay.get(meal.dayOfWeek);
        if (bucket) bucket.push(meal);
        else mealsByDay.set(meal.dayOfWeek, [meal]);
      }
    }

    const choresByDate = new Map<string, Chore[]>();
    if (overlays.chores) {
      for (const chore of resolvedChores) {
        const key = choreDateKey(chore);
        if (!key) continue;
        const bucket = choresByDate.get(key);
        if (bucket) bucket.push(chore);
        else choresByDate.set(key, [chore]);
      }
    }

    const tasksByDate = new Map<string, Task[]>();
    if (overlays.tasks) {
      for (const task of resolvedTasks) {
        if (!task.dueDate) continue;
        const key = dateKey(task.dueDate);
        const bucket = tasksByDate.get(key);
        if (bucket) bucket.push(task);
        else tasksByDate.set(key, [task]);
      }
    }

    const weatherByDate = new Map<string, NonNullable<WeatherData['forecast']>[number]>();
    for (const forecast of weather?.forecast ?? []) {
      weatherByDate.set(dateKey(forecast.date), forecast);
    }

    let cursor = start;
    let safety = 0;
    while (cursor <= end && safety < 366) {
      const date = cursor;
      const dayOfWeek = DAYS_OF_WEEK[date.getDay()] as DayOfWeek;
      const key = dateKey(date);

      const dayEvents = eventsByDate.get(key) ?? EMPTY_EVENTS;
      const allDayEvents = dayEvents
        .filter((e) => e.allDay)
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      const timedEvents = dayEvents
        .filter((e) => !e.allDay)
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      const dayMeals = (mealsByDay.get(dayOfWeek) ?? EMPTY_MEALS)
        .filter((m) => isMealForWeek(m, date))
        .sort((a, b) => MEAL_TYPE_ORDER[a.mealType] - MEAL_TYPE_ORDER[b.mealType]);

      const dayChores = (choresByDate.get(key) ?? EMPTY_CHORES)
        .sort((a, b) => a.title.localeCompare(b.title));

      const dayTasks = (tasksByDate.get(key) ?? EMPTY_TASKS)
        .sort((a, b) => {
          return TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority];
        });

      const dayWeather = weatherByDate.get(key);

      map.set(key, {
        date,
        dayOfWeek,
        allDayEvents,
        timedEvents,
        meals: dayMeals,
        chores: dayChores,
        tasks: dayTasks,
        weather: dayWeather,
      });

      cursor = addDays(cursor, 1);
      safety += 1;
    }

    return map;
    // fromKey/toKey trigger recompute on actual date changes, not Date identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fromKey,
    toKey,
    events,
    resolvedMeals,
    resolvedChores,
    resolvedTasks,
    weather,
    overlays.events,
    overlays.meals,
    overlays.chores,
    overlays.tasks,
    displayTimezone,
  ]);

  const loading =
    (overlays.events && fetchEvents && eventsLoading) ||
    (overlays.meals && !hasExternalMeals && mealsLoading) ||
    (overlays.chores && !hasExternalChores && choresLoading) ||
    (overlays.tasks && !hasExternalTasks && tasksLoading);

  const error =
    (overlays.events && fetchEvents ? eventsError : null) ||
    (overlays.meals && !hasExternalMeals ? mealsError : null) ||
    (overlays.chores && !hasExternalChores ? choresError : null) ||
    (overlays.tasks && !hasExternalTasks ? tasksError : null);

  const refresh = useCallback(async () => {
    const promises: Promise<unknown>[] = [];
    if (fetchEvents && overlays.events) promises.push(refreshEvents());
    if (overlays.meals) {
      promises.push(
        hasExternalMeals
          ? (refreshExternalMeals?.() ?? Promise.resolve())
          : refreshMeals(),
      );
    }
    if (overlays.chores) {
      promises.push(
        hasExternalChores
          ? (refreshExternalChores?.() ?? Promise.resolve())
          : refreshChores(),
      );
    }
    if (overlays.tasks) {
      promises.push(
        hasExternalTasks
          ? (refreshExternalTasks?.() ?? Promise.resolve())
          : refreshTasks(),
      );
    }
    await Promise.all(promises);
  }, [
    fetchEvents,
    hasExternalChores,
    hasExternalMeals,
    hasExternalTasks,
    overlays.chores,
    overlays.events,
    overlays.meals,
    overlays.tasks,
    refreshEvents,
    refreshExternalChores,
    refreshExternalMeals,
    refreshExternalTasks,
    refreshChores,
    refreshMeals,
    refreshTasks,
  ]);

  return { bucketsByDate, loading: Boolean(loading), error: error ?? null, refresh };
}

/**
 * A meal's `weekOf` is the YYYY-MM-DD of the week start (Sun or Mon, depending
 * on settings). For a given target date we accept the meal if the date falls
 * within the 7-day window starting at `weekOf`.
 */
function isMealForWeek(meal: Meal, date: Date): boolean {
  if (!meal.weekOf) return false;
  // weekOf is a YYYY-MM-DD DATE column. `new Date('YYYY-MM-DD')` parses as
  // UTC midnight, which shifts the day backwards in any negative-UTC timezone
  // and lands the meal in last week. Parse as a LOCAL calendar date instead.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(meal.weekOf);
  if (!m) return false;
  const weekStart = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(weekStart.getTime())) return false;
  const weekEnd = addDays(weekStart, 7);
  return date >= weekStart && date < weekEnd;
}
