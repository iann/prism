/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useAutoHideUI } from '../useAutoHideUI';

const mockUsePathname = jest.fn((): string | null => '/');

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

describe('useAutoHideUI', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    localStorage.setItem('prism:auto-hide-ui', 'true');
    mockUsePathname.mockReturnValue('/');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('hides dashboard chrome after ten seconds of inactivity', () => {
    const { result } = renderHook(() => useAutoHideUI());

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(result.current.uiHidden).toBe(true);
  });

  it('does not hide chrome while the pathname is unavailable', () => {
    mockUsePathname.mockReturnValue(null);
    const { result } = renderHook(() => useAutoHideUI());

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(result.current.uiHidden).toBe(false);
  });

  it('ignores scroll events caused by the hide reflow', () => {
    const { result } = renderHook(() => useAutoHideUI());

    act(() => {
      jest.advanceTimersByTime(10_000);
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.uiHidden).toBe(true);
  });

  it('still wakes on a genuine scroll after the reflow settles', () => {
    const { result } = renderHook(() => useAutoHideUI());

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current.uiHidden).toBe(true);

    act(() => {
      jest.advanceTimersByTime(751);
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.uiHidden).toBe(false);
  });

  it('wakes immediately on deliberate input', () => {
    const { result } = renderHook(() => useAutoHideUI());

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current.uiHidden).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('mousedown'));
    });

    expect(result.current.uiHidden).toBe(false);
  });

  it('keeps chrome hidden for protected nested interactions and refreshes the timer', () => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-auto-hide-keep', '');
    const control = document.createElement('button');
    overlay.appendChild(control);
    document.body.appendChild(overlay);

    const { result } = renderHook(() => useAutoHideUI());

    // The production handler deliberately throttles mousemove using the
    // monotonic performance clock. Control that clock so this test proves the
    // protected event is accepted instead of accidentally testing the throttle.
    let performanceTime = 1_000;
    jest.spyOn(performance, 'now').mockImplementation(() => performanceTime);

    act(() => {
      jest.advanceTimersByTime(9_500);
    });
    expect(result.current.uiHidden).toBe(false);

    act(() => {
      performanceTime += 401;
      control.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    });
    expect(result.current.uiHidden).toBe(false);

    // The accepted protected mousemove refreshed the timer at 9.5s. If it had
    // been rejected by throttling, the original timer would have hidden the
    // chrome at 10s instead of leaving it visible until 19.5s.
    act(() => {
      jest.advanceTimersByTime(9_999);
    });
    expect(result.current.uiHidden).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.uiHidden).toBe(true);

    act(() => {
      control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      control.dispatchEvent(new Event('touchstart', { bubbles: true }));
      control.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      control.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    expect(result.current.uiHidden).toBe(true);

    document.body.removeChild(overlay);
  });

  it('wakes on an interaction outside a protected overlay', () => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-auto-hide-keep', '');
    document.body.appendChild(overlay);

    const { result } = renderHook(() => useAutoHideUI());

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current.uiHidden).toBe(true);

    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(result.current.uiHidden).toBe(false);

    document.body.removeChild(overlay);
  });
});
