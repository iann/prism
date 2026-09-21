'use client';

import { useContext, useEffect, useRef } from 'react';
import { usePollingInterval } from './usePollingInterval';
import { useDisplayIdle } from './useDisplayIdle';
import { PollingScopeContext } from './pollingScope';

interface PollingOptions {
  /** Keep polling while the screensaver is covering the dashboard. */
  pollWhileIdle?: boolean;
  /** Refresh once when network connectivity returns, even without an interval. */
  refreshOnReconnect?: boolean;
}

type PollingCallback = (options?: { force?: boolean }) => void | Promise<void>;

/** Upstream API: options control whether display-idle pauses this poll. */
export function useVisibilityPolling(
  callback: PollingCallback,
  intervalMs: number,
  options?: PollingOptions,
): void;

/** Personal API: stagger the first/resumed tick and optionally ignore perf mode. */
export function useVisibilityPolling(
  callback: PollingCallback,
  intervalMs: number,
  offsetMs?: number,
  respectPerformanceMode?: boolean,
  refreshOnReconnect?: boolean,
): void;

export function useVisibilityPolling(
  callback: PollingCallback,
  intervalMs: number,
  offsetOrOptions: number | PollingOptions = 0,
  respectPerformanceMode = true,
  refreshOnReconnectOverride?: boolean,
): void {
  const offsetMs = typeof offsetOrOptions === 'number' ? offsetOrOptions : 0;
  const pollWhileIdle = typeof offsetOrOptions === 'object' && offsetOrOptions.pollWhileIdle === true;
  const refreshOnReconnect = typeof offsetOrOptions === 'object'
    ? offsetOrOptions.refreshOnReconnect ?? intervalMs > 0
    : refreshOnReconnectOverride ?? intervalMs > 0;
  const performanceInterval = usePollingInterval(intervalMs);
  const effectiveInterval = respectPerformanceMode ? performanceInterval : intervalMs;
  const scope = useContext(PollingScopeContext);
  const displayIdle = useDisplayIdle();
  // Screensaver widgets are the visible copy while idle. Away/Babysitter mode
  // toggles also keep polling because they decide which overlay is visible.
  const exempt = scope === 'screensaver' || pollWhileIdle;
  const paused = exempt ? false : displayIdle;

  // Read the latest callback at tick time without resetting the timer every
  // time a caller recreates its fetch closure.
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const inFlightRef = useRef(false);
  const reconnectPendingRef = useRef(false);

  // True after a hidden/idle transition. A resumed poll catches up once, then
  // returns to its regular cadence; it never replays missed ticks.
  const wasPaused = useRef(false);

  useEffect(() => {
    if (effectiveInterval <= 0 && !refreshOnReconnect) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const clearTimers = () => {
      if (timeout !== null) clearTimeout(timeout);
      if (interval !== null) clearInterval(interval);
      timeout = null;
      interval = null;
    };

    const runCallback = (force = false) => {
      // A slow wall display can still be processing a request when the next
      // tick arrives. Do not stack another fetch on top of it.
      if (inFlightRef.current) {
        if (force) reconnectPendingRef.current = true;
        return;
      }
      inFlightRef.current = true;

      let result: void | Promise<void>;
      try {
        // useFetch accepts this option to bypass its short-lived cache when
        // connectivity returns. Other polling callbacks can ignore it.
        result = force ? callbackRef.current({ force: true }) : callbackRef.current();
      } catch {
        inFlightRef.current = false;
        return;
      }

      if (!result || typeof result.then !== 'function') {
        inFlightRef.current = false;
        return;
      }

      result
        .catch(() => {
          // Fetch hooks report their own errors. Prevent rejected callbacks
          // from becoming unhandled promise rejections here.
        })
        .finally(() => {
          inFlightRef.current = false;
          if (
            active &&
            reconnectPendingRef.current &&
            !paused &&
            !document.hidden &&
            (typeof navigator === 'undefined' || navigator.onLine !== false)
          ) {
            reconnectPendingRef.current = false;
            runCallback(true);
          }
        });
    };

    const startInterval = (force = false) => {
      runCallback(force);
      if (effectiveInterval > 0) {
        interval = setInterval(() => runCallback(), effectiveInterval);
      }
    };

    const schedule = () => {
      clearTimers();
      if (paused || document.hidden || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        wasPaused.current = true;
        return;
      }

      if (effectiveInterval <= 0) {
        if (wasPaused.current) {
          wasPaused.current = false;
          const force = reconnectPendingRef.current;
          reconnectPendingRef.current = false;
          runCallback(force);
        }
        return;
      }

      // Mounts wait for a full interval so initial fetch effects own the first
      // request. A genuine resume catches up immediately, or after the caller's
      // offset when refresh domains are deliberately staggered.
      const delay = wasPaused.current ? offsetMs : effectiveInterval + offsetMs;
      wasPaused.current = false;
      const force = reconnectPendingRef.current;
      reconnectPendingRef.current = false;
      if (delay > 0) {
        timeout = setTimeout(() => startInterval(force), delay);
      } else {
        startInterval(force);
      }
    };

    const handleOffline = () => {
      wasPaused.current = true;
      clearTimers();
    };

    const handleOnline = () => {
      reconnectPendingRef.current = true;
      wasPaused.current = true;
      schedule();
    };

    schedule();
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      active = false;
      clearTimers();
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [effectiveInterval, paused, offsetMs, refreshOnReconnect]);
}
