/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { usePerformanceMode } from '../usePerformanceMode';

function setHardwareConcurrency(value: number) {
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    configurable: true,
    value,
  });
}

describe('usePerformanceMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('performance-mode');
    window.history.replaceState(null, '', '/');
    setHardwareConcurrency(8);
  });

  it('exposes when the stored preference has been resolved', async () => {
    localStorage.setItem('prism-perf-mode', 'true');
    const { result } = renderHook(() => usePerformanceMode());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.enabled).toBe(true);
    expect(document.documentElement.classList.contains('performance-mode')).toBe(true);
  });

  it('enables itself on low-core hardware', async () => {
    setHardwareConcurrency(4);
    const { result } = renderHook(() => usePerformanceMode());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem('prism-perf-mode')).toBe('true');
  });

  it('honors an explicit stored preference over hardware detection', async () => {
    setHardwareConcurrency(2);
    localStorage.setItem('prism-perf-mode', 'false');
    const { result } = renderHook(() => usePerformanceMode());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.enabled).toBe(false);
    expect(document.documentElement.classList.contains('performance-mode')).toBe(false);
  });

  it('applies and removes the perf query parameter', async () => {
    window.history.replaceState(null, '', '/?perf=1&view=kitchen#clock');
    const { result } = renderHook(() => usePerformanceMode());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.enabled).toBe(true);
    expect(window.location.pathname + window.location.search + window.location.hash)
      .toBe('/?view=kitchen#clock');
  });

  it('keeps multiple hook consumers in sync', async () => {
    const { result } = renderHook(() => ({
      first: usePerformanceMode(),
      second: usePerformanceMode(),
    }));
    await waitFor(() => expect(result.current.first.ready).toBe(true));

    act(() => result.current.first.setEnabled(true));

    expect(result.current.first.enabled).toBe(true);
    expect(result.current.second.enabled).toBe(true);
    expect(document.documentElement.classList.contains('performance-mode')).toBe(true);
  });
});
