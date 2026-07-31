/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useCalendarWidgetPrefs } from '../useCalendarWidgetPrefs';

describe('useCalendarWidgetPrefs', () => {
  beforeEach(() => localStorage.clear());

  it('isolates view preferences by calendar instance', () => {
    const first = renderHook(() => useCalendarWidgetPrefs(48, 48, 'calendar'));
    const second = renderHook(() => useCalendarWidgetPrefs(48, 48, 'calendar-2'));

    act(() => first.result.current.setViewType('multiWeek4'));
    act(() => second.result.current.setViewType('day'));

    expect(localStorage.getItem('prism-calendar-view')).toBe('multiWeek4');
    expect(localStorage.getItem('prism-calendar-calendar-2-view')).toBe('day');
    expect(first.result.current.viewType).toBe('multiWeek4');
    expect(second.result.current.viewType).toBe('day');
    expect(first.result.current.resolvedView).toBe('multiWeek');
    expect(first.result.current.resolvedWeekCount).toBe(4);
    expect(second.result.current.resolvedView).toBe('day');
  });

  it('retains the legacy key for the original calendar instance', () => {
    localStorage.setItem('prism-calendar-view', 'multiWeek4');
    const hook = renderHook(() => useCalendarWidgetPrefs(48, 48, 'calendar'));
    expect(hook.result.current.viewType).toBe('multiWeek4');
  });

  it('uses the legacy namespace when no instance ID is supplied', () => {
    localStorage.setItem('prism-calendar-display-mode', 'cards');
    const hook = renderHook(() => useCalendarWidgetPrefs(48, 48));

    expect(hook.result.current.displayMode).toBe('cards');
    expect(localStorage.getItem('prism-calendar-display-mode')).toBe('cards');
  });

  it('isolates every persisted preference, not only the selected view', () => {
    const first = renderHook(() => useCalendarWidgetPrefs(48, 48, 'calendar'));
    const second = renderHook(() => useCalendarWidgetPrefs(48, 48, 'calendar-2'));

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

    expect(localStorage.getItem('prism-calendar-bordered')).toBe('true');
    expect(localStorage.getItem('prism-calendar-calendar-2-bordered')).toBe('false');
    expect(localStorage.getItem('prism-calendar-notes-visible')).toBe('true');
    expect(localStorage.getItem('prism-calendar-calendar-2-notes-visible')).toBe('false');
    expect(localStorage.getItem('prism-calendar-display-mode')).toBe('cards');
    expect(localStorage.getItem('prism-calendar-calendar-2-display-mode')).toBe('inline');
    expect(localStorage.getItem('prism-calendar-hide-weekends')).toBe('true');
    expect(localStorage.getItem('prism-calendar-calendar-2-hide-weekends')).toBe('false');
    expect(localStorage.getItem('prism-calendar-overlays')).toBe(
      JSON.stringify({ events: false, meals: true, chores: false, tasks: true })
    );
    expect(localStorage.getItem('prism-calendar-calendar-2-overlays')).toBe(
      JSON.stringify({ events: true, meals: false, chores: true, tasks: false })
    );
  });
});
