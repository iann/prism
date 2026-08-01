/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { act, render, screen } from '@testing-library/react';

const mockUseAutoHideUI = jest.fn();

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

jest.mock('@/lib/hooks/useAutoHideUI', () => ({
  useAutoHideUI: () => mockUseAutoHideUI(),
}));

jest.mock('@/components/widgets/WidgetContainer', () => ({
  WidgetContainer: ({
    children,
    title,
    showHeader = true,
    actions,
  }: React.PropsWithChildren<{
    title?: string;
    showHeader?: boolean;
    actions?: React.ReactNode;
  }>) => (
    <div data-testid="widget-container">
      {showHeader && (
        <header>
          <span>{title}</span>
          {actions}
        </header>
      )}
      {children}
    </div>
  ),
  useWidgetBgOverride: () => null,
}));

jest.mock('../CalendarWidgetControls', () => ({
  CalendarWidgetControls: () => <div data-testid="calendar-controls" />,
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
  mockUseAutoHideUI.mockReturnValue({ uiHidden: false });
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
    calendarGroups: [{ id: 'family', name: 'Family', color: '#2563eb' }],
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

async function renderCalendarWidget() {
  await act(async () => {
    render(<CalendarWidget />);
    await Promise.resolve();
  });
}

describe('CalendarWidget idle chrome', () => {
  it('shows the title, controls, and filter chips while the UI is visible', async () => {
    await renderCalendarWidget();

    expect(screen.queryByText('Calendar')).not.toBeNull();
    expect(screen.queryByTestId('calendar-controls')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeNull();
  });

  it('hides the title, controls, and filter chips while the UI is idle', async () => {
    mockUseAutoHideUI.mockReturnValue({ uiHidden: true });

    await renderCalendarWidget();

    expect(screen.queryByText('Calendar')).toBeNull();
    expect(screen.queryByTestId('calendar-controls')).toBeNull();
    expect(screen.queryByRole('button', { name: 'All' })).toBeNull();
    expect(screen.queryByTestId('agenda-view')).not.toBeNull();
  });
});
