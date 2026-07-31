'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, startOfWeek } from 'date-fns';
import type { OverlayFlags } from '@/lib/hooks/useDayBucketsForRange';

export type WidgetViewType =
  | 'agenda'
  | 'list'
  | 'day'
  | 'week'
  | 'multiWeek'
  | 'multiWeek2'
  | 'multiWeek3'
  | 'multiWeek4'
  | 'month';

export type ResolvedViewType = 'agenda' | 'list' | 'day' | 'week' | 'multiWeek' | 'month';

const VALID_VIEWS: WidgetViewType[] = [
  'agenda',
  'list',
  'day',
  'week',
  'multiWeek',
  'multiWeek2',
  'multiWeek3',
  'multiWeek4',
  'month',
];

export const VIEW_OPTIONS: { value: WidgetViewType; label: string }[] = [
  { value: 'agenda', label: 'Agenda' },
  { value: 'day', label: 'Day' },
  { value: 'list', label: 'List' },
  { value: 'week', label: 'Schedule' },
  { value: 'multiWeek', label: '1W' },
  { value: 'multiWeek2', label: '2W' },
  { value: 'multiWeek3', label: '3W' },
  { value: 'multiWeek4', label: '4W' },
  { value: 'month', label: 'Month' },
];

/** Which views are available at a given grid size (48-column grid) */
export function getAvailableViews(gridW: number, gridH: number): WidgetViewType[] {
  const mw: WidgetViewType[] = ['multiWeek', 'multiWeek2', 'multiWeek3', 'multiWeek4'];
  if (gridW >= 36 && gridH >= 24) return ['agenda', 'list', 'day', 'week', ...mw, 'month'];
  if (gridW >= 24 && gridH >= 36) return ['agenda', 'list', 'day', 'week', ...mw, 'month'];
  if (gridW >= 24 && gridH >= 24) return ['agenda', 'list', 'week', ...mw, 'month'];
  if (gridW >= 16 && gridH >= 16) return ['agenda', 'list', 'week', ...mw];
  return ['agenda'];
}

/** Resolve multiWeekN variant to base view + week count */
export function resolveMultiWeek(vt: WidgetViewType): {
  baseView: ResolvedViewType;
  weekCount: 1 | 2 | 3 | 4;
} {
  if (vt === 'multiWeek') return { baseView: 'multiWeek', weekCount: 1 };
  if (vt === 'multiWeek2') return { baseView: 'multiWeek', weekCount: 2 };
  if (vt === 'multiWeek3') return { baseView: 'multiWeek', weekCount: 3 };
  if (vt === 'multiWeek4') return { baseView: 'multiWeek', weekCount: 4 };
  return { baseView: vt as ResolvedViewType, weekCount: 2 };
}

function getStoragePrefix(instanceId?: string): string {
  // Keep the legacy keys for the original calendar instance so existing
  // users retain their current preference. Additional instances get their
  // own namespace.
  return instanceId && instanceId !== 'calendar'
    ? `prism-calendar-${instanceId}`
    : 'prism-calendar';
}

function readViewPref(storagePrefix: string): WidgetViewType {
  if (typeof window === 'undefined') return 'agenda';
  const saved = localStorage.getItem(`${storagePrefix}-view`);
  // Migrate legacy formats
  if (saved === 'twoWeek') return 'multiWeek2';
  if (saved === 'multiWeek') {
    const wc = Number(localStorage.getItem(`${storagePrefix}-weekcount`) || '2');
    if (wc === 1) return 'multiWeek';
    if (wc === 3) return 'multiWeek3';
    if (wc === 4) return 'multiWeek4';
    return 'multiWeek2';
  }
  if (saved === 'list') return 'agenda';
  if (saved && VALID_VIEWS.includes(saved as WidgetViewType)) return saved as WidgetViewType;
  return 'agenda';
}

/**
 * Manages view-type selection, date navigation, and preference persistence
 * for the CalendarWidget. Extracted from the component to keep it under 250 lines.
 */
export function useCalendarWidgetPrefs(gridW: number, gridH: number, instanceId?: string) {
  const storagePrefix = getStoragePrefix(instanceId);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [widgetBordered, setWidgetBordered] = useState(
    () =>
      typeof window !== 'undefined' && localStorage.getItem(`${storagePrefix}-bordered`) === 'true'
  );
  const [mergedView, setMergedView] = useState(false);
  const [showNotes, setShowNotes] = useState(
    () =>
      typeof window !== 'undefined' &&
      localStorage.getItem(`${storagePrefix}-notes-visible`) === 'true'
  );
  const [viewType, setViewType] = useState<WidgetViewType>(() => readViewPref(storagePrefix));
  const [displayMode, setDisplayMode] = useState<'inline' | 'cards'>(
    // Match useCalendarViewData's default: 'cards' only if explicitly set,
    // else 'inline'. Same localStorage key — divergent defaults caused the
    // widget and subpage to render differently on first load.
    () =>
      typeof window !== 'undefined' &&
      localStorage.getItem(`${storagePrefix}-display-mode`) === 'cards'
        ? 'cards'
        : 'inline'
  );
  const [hideWeekends, setHideWeekends] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      localStorage.getItem(`${storagePrefix}-hide-weekends`) === 'true'
  );
  const [overlays, setOverlays] = useState<OverlayFlags>(() => {
    if (typeof window === 'undefined')
      return { events: true, meals: true, chores: true, tasks: true };
    try {
      const raw = localStorage.getItem(`${storagePrefix}-overlays`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          events: parsed.events !== false,
          meals: parsed.meals !== false,
          chores: parsed.chores !== false,
          tasks: parsed.tasks !== false,
        };
      }
    } catch {
      /* ignore */
    }
    return { events: true, meals: true, chores: true, tasks: true };
  });

  // Persist prefs
  useEffect(() => {
    localStorage.setItem(`${storagePrefix}-view`, viewType);
  }, [storagePrefix, viewType]);
  useEffect(() => {
    localStorage.setItem(`${storagePrefix}-bordered`, String(widgetBordered));
  }, [storagePrefix, widgetBordered]);
  useEffect(() => {
    localStorage.setItem(`${storagePrefix}-notes-visible`, String(showNotes));
  }, [storagePrefix, showNotes]);
  useEffect(() => {
    localStorage.setItem(`${storagePrefix}-display-mode`, displayMode);
  }, [storagePrefix, displayMode]);
  useEffect(() => {
    localStorage.setItem(`${storagePrefix}-hide-weekends`, String(hideWeekends));
  }, [storagePrefix, hideWeekends]);
  useEffect(() => {
    localStorage.setItem(`${storagePrefix}-overlays`, JSON.stringify(overlays));
  }, [storagePrefix, overlays]);

  // Derived view state
  const availableViews = useMemo(() => getAvailableViews(gridW, gridH), [gridW, gridH]);
  const effectiveView = availableViews.includes(viewType) ? viewType : 'agenda';
  const { baseView: resolvedView, weekCount: resolvedWeekCount } = resolveMultiWeek(effectiveView);
  const viewUnavailable = viewType !== effectiveView;

  // Navigation
  const goToToday = useCallback(() => setCurrentDate(new Date()), []);
  const goToPrevious = useCallback(() => {
    setCurrentDate((d) => {
      switch (resolvedView) {
        case 'day':
          return subDays(d, 1);
        case 'list':
        case 'week':
          return subWeeks(d, 1);
        case 'multiWeek':
          return subWeeks(d, resolvedWeekCount);
        case 'month':
          return subMonths(d, 1);
        default:
          return subDays(d, 3);
      }
    });
  }, [resolvedView, resolvedWeekCount]);
  const goToNext = useCallback(() => {
    setCurrentDate((d) => {
      switch (resolvedView) {
        case 'day':
          return addDays(d, 1);
        case 'list':
        case 'week':
          return addWeeks(d, 1);
        case 'multiWeek':
          return addWeeks(d, resolvedWeekCount);
        case 'month':
          return addMonths(d, 1);
        default:
          return addDays(d, 3);
      }
    });
  }, [resolvedView, resolvedWeekCount]);

  return {
    currentDate,
    setCurrentDate,
    widgetBordered,
    setWidgetBordered,
    mergedView,
    setMergedView,
    showNotes,
    setShowNotes,
    viewType,
    setViewType,
    displayMode,
    setDisplayMode,
    hideWeekends,
    setHideWeekends,
    overlays,
    setOverlays,
    availableViews,
    effectiveView,
    resolvedView,
    resolvedWeekCount,
    viewUnavailable,
    goToToday,
    goToPrevious,
    goToNext,
  };
}
