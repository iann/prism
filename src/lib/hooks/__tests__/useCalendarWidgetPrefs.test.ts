/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import * as React from 'react';
import { TimeFormatProvider } from '@/components/providers';
import { useCalendarWidgetPrefs } from '../useCalendarWidgetPrefs';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(TimeFormatProvider, null, children);

beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ settings: {} }) }),
  ) as unknown as typeof fetch;
});

afterAll(() => {
  delete (global as { fetch?: unknown }).fetch;
});

describe('useCalendarWidgetPrefs', () => {
  beforeEach(() => localStorage.clear());

  it('isolates view preferences by calendar instance', () => {
    localStorage.setItem('prism-calendar-view:calendar', 'multiWeek4');
    const first = renderHook(() => useCalendarWidgetPrefs(48, 48, 'calendar'), { wrapper });
    const second = renderHook(() => useCalendarWidgetPrefs(48, 48, 'calendar-2'), { wrapper });

    act(() => second.result.current.setViewType('day'));

    expect(localStorage.getItem('prism-calendar-view:calendar')).toBe('month');
    expect(localStorage.getItem('prism-calendar-view:calendar-2')).toBe('day');
    expect(first.result.current.viewType).toBe('month');
    expect(second.result.current.viewType).toBe('day');
    expect(first.result.current.resolvedView).toBe('month');
    expect(first.result.current.resolvedWeekCount).toBe(2);
    expect(second.result.current.resolvedView).toBe('day');
  });

  it('retains the legacy key for the original calendar instance', () => {
    localStorage.setItem('prism-calendar-view', 'multiWeek4');
    const hook = renderHook(() => useCalendarWidgetPrefs(48, 48, 'calendar'), { wrapper });
    expect(hook.result.current.viewType).toBe('month');
  });

  it('uses the legacy namespace when no instance ID is supplied', () => {
    localStorage.setItem('prism-calendar-display-mode', 'cards');
    const hook = renderHook(() => useCalendarWidgetPrefs(48, 48), { wrapper });

    expect(hook.result.current.displayMode).toBe('cards');
    expect(localStorage.getItem('prism-calendar-display-mode')).toBe('cards');
  });

  it('isolates every persisted preference, not only the selected view', () => {
    const first = renderHook(() => useCalendarWidgetPrefs(48, 48, 'calendar'), { wrapper });
    const second = renderHook(() => useCalendarWidgetPrefs(48, 48, 'calendar-2'), { wrapper });

    act(() => {
      first.result.current.setWidgetBordered(true);
      first.result.current.setShowNotes(true);
      first.result.current.setDisplayMode('cards');
      first.result.current.setHideWeekends(true);
      first.result.current.setOverlays({ events: false, meals: true, chores: false, tasks: true });

      second.result.current.setWidgetBordered(false);
      second.result.current.setShowNotes(false);
      second.result.current.setDisplayMode('inline');
      second.result.current.setHideWeekends(false);
      second.result.current.setOverlays({ events: true, meals: false, chores: true, tasks: false });
    });

    expect(localStorage.getItem('prism-calendar-bordered:calendar')).toBe('true');
    expect(localStorage.getItem('prism-calendar-bordered:calendar-2')).toBe('false');
    expect(localStorage.getItem('prism-calendar-notes-visible:calendar')).toBe('true');
    expect(localStorage.getItem('prism-calendar-notes-visible:calendar-2')).toBe('false');
    expect(localStorage.getItem('prism-calendar-display-mode:calendar')).toBe('cards');
    expect(localStorage.getItem('prism-calendar-display-mode:calendar-2')).toBe('inline');
    expect(localStorage.getItem('prism-calendar-hide-weekends:calendar')).toBe('true');
    expect(localStorage.getItem('prism-calendar-hide-weekends:calendar-2')).toBe('false');
    expect(localStorage.getItem('prism-calendar-overlays:calendar')).toBe(
      JSON.stringify({ events: false, meals: true, chores: false, tasks: true })
    );
    expect(localStorage.getItem('prism-calendar-overlays:calendar-2')).toBe(
      JSON.stringify({ events: true, meals: false, chores: true, tasks: false })
    );
  });
});
