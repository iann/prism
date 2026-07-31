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
});
