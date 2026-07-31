/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { act, render } from '@testing-library/react';

jest.mock('@/components/providers', () => ({
  useAuth: () => ({ activeUser: null }),
}));

jest.mock('@/lib/hooks', () => ({
  useCalendarEvents: jest.fn(),
  useCalendarFilter: jest.fn(),
  useCalendarNotes: jest.fn(),
}));

jest.mock('@/lib/hooks/useCalendarWidgetPrefs', () => ({
  useCalendarWidgetPrefs: jest.fn(),
  VIEW_OPTIONS: [],
}));

jest.mock('@/lib/hooks/useDayBucketsForRange', () => ({
  useDayBucketsForRange: jest.fn(),
}));

jest.mock('@/lib/hooks/useWeekMutations', () => ({
  useWeekMutations: jest.fn(),
}));

jest.mock('@/lib/hooks/useWeekStartsOn', () => ({
  useWeekStartsOn: () => ({ weekStartsOn: 0 }),
}));

jest.mock('@/components/widgets/WidgetContainer', () => ({
  WidgetContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  useWidgetBgOverride: () => null,
}));

jest.mock('../CalendarWidgetControls', () => ({
  CalendarWidgetControls: () => null,
}));

jest.mock('@/components/calendar/AgendaView', () => ({
  AgendaView: () => <div data-testid="agenda-view" />,
}));

import { useCalendarEvents, useCalendarFilter, useCalendarNotes } from '@/lib/hooks';
import { useCalendarWidgetPrefs } from '@/lib/hooks/useCalendarWidgetPrefs';
import { useDayBucketsForRange } from '@/lib/hooks/useDayBucketsForRange';
import { useWeekMutations } from '@/lib/hooks/useWeekMutations';
import { CalendarWidget } from '../CalendarWidget';

const calendarPrefs = {
  currentDate: new Date('2026-07-30T12:00:00.000Z'),
  setCurrentDate: jest.fn(),
  widgetBordered: false,
  setWidgetBordered: jest.fn(),
  mergedView: false,
  setMergedView: jest.fn(),
  showNotes: false,
  setShowNotes: jest.fn(),
  viewType: 'agenda' as const,
  setViewType: jest.fn(),
  displayMode: 'inline' as const,
  setDisplayMode: jest.fn(),
  hideWeekends: false,
  setHideWeekends: jest.fn(),
  overlays: { events: true, meals: true, chores: true, tasks: true },
  setOverlays: jest.fn(),
  availableViews: ['agenda' as const],
  effectiveView: 'agenda' as const,
  resolvedView: 'agenda' as const,
  resolvedWeekCount: 1 as const,
  viewUnavailable: false,
  goToToday: jest.fn(),
  goToPrevious: jest.fn(),
  goToNext: jest.fn(),
};

beforeEach(() => {
  jest.mocked(useCalendarWidgetPrefs).mockReturnValue(calendarPrefs);
  jest.mocked(useCalendarEvents).mockReturnValue({
    events: [],
    loading: false,
    error: null,
    refresh: jest.fn(),
    syncCalendars: jest.fn(),
  });
  jest.mocked(useCalendarFilter).mockReturnValue({
    selectedCalendarIds: new Set(['all']),
    toggleCalendar: jest.fn(),
    filterEvents: (events) => events,
    calendarGroups: [],
  });
  jest.mocked(useCalendarNotes).mockReturnValue({
    notesByDate: new Map(),
    loading: false,
    error: null,
    upsertNote: jest.fn(),
    refresh: jest.fn(),
  });
  jest.mocked(useDayBucketsForRange).mockReturnValue({
    bucketsByDate: new Map(),
    loading: false,
    error: null,
    refresh: jest.fn(),
  });
  jest.mocked(useWeekMutations).mockReturnValue({
    moveChore: jest.fn(),
    moveTask: jest.fn(),
    moveMeal: jest.fn(),
    moveEvent: jest.fn(),
  });
});

describe('CalendarWidget instance integration', () => {
  it('receives the unique instance ID and disables its own events request when data is shared', async () => {
    const sharedEvents: never[] = [];

    await act(async () => {
      render(
        <CalendarWidget instanceId="calendar-2" gridW={24} gridH={24} events={sharedEvents} />
      );
      await Promise.resolve();
    });

    expect(useCalendarWidgetPrefs).toHaveBeenCalledWith(24, 24, 'calendar-2');
    expect(useCalendarEvents).toHaveBeenCalledWith({ daysToShow: 60, enabled: false });
  });

  it('keeps API loading enabled when no shared events prop is supplied', async () => {
    await act(async () => {
      render(<CalendarWidget instanceId="calendar-2" />);
      await Promise.resolve();
    });

    expect(useCalendarEvents).toHaveBeenCalledWith({ daysToShow: 60, enabled: true });
  });
});
