/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useNWSAlerts } from '../useNWSAlerts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAlert(overrides: Partial<{
  id: string;
  event: string;
  headline: string;
  description: string;
  effective: string;
  expires: string;
}> = {}) {
  return {
    id: 'urn:oid:2.49.0.1.840.0.test',
    event: 'Tornado Warning',
    headline: 'Tornado Warning until 4:00 PM EDT',
    description: 'A tornado has been spotted.',
    effective: '2024-06-01T12:00:00Z',
    expires: '2024-06-01T16:00:00Z',
    ...overrides,
  };
}

function resolvedFetch(alerts: ReturnType<typeof makeAlert>[]) {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ alerts }),
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useNWSAlerts', () => {
  it('starts in loading state', () => {
    global.fetch = resolvedFetch([]);
    const { result } = renderHook(() => useNWSAlerts());
    expect(result.current.loading).toBe(true);
  });

  it('sets loading false after the initial fetch', async () => {
    global.fetch = resolvedFetch([]);
    const { result } = renderHook(() => useNWSAlerts());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.loading).toBe(false);
  });

  it('surfaces alerts that match the severity filter', async () => {
    global.fetch = resolvedFetch([
      makeAlert({ id: '1', event: 'Tornado Warning' }),
      makeAlert({ id: '2', event: 'Severe Thunderstorm Watch' }),
    ]);
    const { result } = renderHook(() => useNWSAlerts());
    await act(async () => { await Promise.resolve(); });

    expect(result.current.alerts).toHaveLength(2);
    expect(result.current.hasSevereAlert).toBe(true);
  });

  it('filters out non-severe events', async () => {
    global.fetch = resolvedFetch([
      makeAlert({ id: '1', event: 'Tornado Warning' }),           // severe
      makeAlert({ id: '2', event: 'Beach Hazard Statement' }),    // not severe
      makeAlert({ id: '3', event: 'Severe Thunderstorm Watch' }), // severe
    ]);
    const { result } = renderHook(() => useNWSAlerts());
    await act(async () => { await Promise.resolve(); });

    const ids = result.current.alerts.map((a) => a.id);
    expect(ids).toEqual(['1', '3']);
    expect(result.current.hasSevereAlert).toBe(true);
  });

  it('returns empty alerts and hasSevereAlert=false when no severe events', async () => {
    global.fetch = resolvedFetch([
      makeAlert({ event: 'Special Weather Statement' }),
    ]);
    const { result } = renderHook(() => useNWSAlerts());
    await act(async () => { await Promise.resolve(); });

    expect(result.current.alerts).toHaveLength(0);
    expect(result.current.hasSevereAlert).toBe(false);
  });

  it('respects a custom severityFilter prop', async () => {
    global.fetch = resolvedFetch([
      makeAlert({ id: '1', event: 'Flash Flood Warning' }),
      makeAlert({ id: '2', event: 'Tornado Warning' }),
    ]);
    const { result } = renderHook(() =>
      useNWSAlerts({ severityFilter: ['Flash Flood Warning'] })
    );
    await act(async () => { await Promise.resolve(); });

    const ids = result.current.alerts.map((a) => a.id);
    expect(ids).toEqual(['1']);
  });

  it('polls again after the configured interval', async () => {
    global.fetch = resolvedFetch([]);
    renderHook(() => useNWSAlerts({ pollIntervalMs: 5_000 }));
    await act(async () => { await Promise.resolve(); });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('clears the interval on unmount', async () => {
    global.fetch = resolvedFetch([]);
    const { unmount } = renderHook(() => useNWSAlerts({ pollIntervalMs: 5_000 }));
    await act(async () => { await Promise.resolve(); });
    unmount();

    await act(async () => { jest.advanceTimersByTime(10_000); });
    // fetch should not be called again after unmount
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves existing alerts on network error', async () => {
    (global.fetch as jest.Mock) = jest.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ alerts: [makeAlert({ id: 'kept' })] }),
      })
      .mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useNWSAlerts({ pollIntervalMs: 1_000 }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.alerts).toHaveLength(1);

    // Trigger the second poll (which fails)
    await act(async () => {
      jest.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    // Alerts stay; error is surfaced
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0]!.id).toBe('kept');
    expect(result.current.error).toBeTruthy();
  });

  it('clears error state on a successful poll after an error', async () => {
    (global.fetch as jest.Mock) = jest.fn()
      .mockRejectedValueOnce(new Error('gone'))
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ alerts: [] }),
      });

    const { result } = renderHook(() => useNWSAlerts({ pollIntervalMs: 1_000 }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.error).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(result.current.error).toBeNull();
  });

  it('stays dormant (no error) when API returns 503 not-configured', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'NWS alerts not configured.' }),
    });

    const { result } = renderHook(() => useNWSAlerts());
    await act(async () => { await Promise.resolve(); });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.alerts).toHaveLength(0);
  });
});
