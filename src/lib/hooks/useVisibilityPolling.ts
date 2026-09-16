'use client';

import { useContext, useEffect, useRef } from 'react';
import { usePollingInterval } from './usePollingInterval';
import { useDisplayIdle } from './useDisplayIdle';
import { PollingScopeContext } from './pollingScope';

interface PollingOptions {
  /** Keep polling while the screensaver is covering the dashboard. */
  pollWhileIdle?: boolean;
}

/** Upstream API: options control whether display-idle pauses this poll. */
export function useVisibilityPolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  options?: PollingOptions,
): void;

/** Personal API: stagger the first/resumed tick and optionally ignore perf mode. */
export function useVisibilityPolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  offsetMs?: number,
  respectPerformanceMode?: boolean,
): void;

export function useVisibilityPolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  offsetOrOptions: number | PollingOptions = 0,
  respectPerformanceMode = true,
): void {
  const offsetMs = typeof offsetOrOptions === 'number' ? offsetOrOptions : 0;
  const pollWhileIdle = typeof offsetOrOptions === 'object' && offsetOrOptions.pollWhileIdle === true;
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

  // True after a hidden/idle transition. A resumed poll catches up once, then
  // returns to its regular cadence; it never replays missed ticks.
  const wasPaused = useRef(false);

  useEffect(() => {
    if (effectiveInterval <= 0) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (timeout !== null) clearTimeout(timeout);
      if (interval !== null) clearInterval(interval);
      timeout = null;
      interval = null;
    };

    const runCallback = () => {
      // A slow wall display can still be processing a request when the next
      // tick arrives. Do not stack another fetch on top of it.
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      let result: void | Promise<void>;
      try {
        result = callbackRef.current();
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
        });
    };

    const startInterval = () => {
      runCallback();
      interval = setInterval(runCallback, effectiveInterval);
    };

    const schedule = () => {
      clearTimers();
      if (paused || document.hidden) {
        wasPaused.current = true;
        return;
      }

      // Mounts wait for a full interval so initial fetch effects own the first
      // request. A genuine resume catches up immediately, or after the caller's
      // offset when refresh domains are deliberately staggered.
      const delay = wasPaused.current ? offsetMs : effectiveInterval + offsetMs;
      wasPaused.current = false;
      if (delay > 0) {
        timeout = setTimeout(startInterval, delay);
      } else {
        startInterval();
      }
    };

    schedule();
    document.addEventListener('visibilitychange', schedule);

    return () => {
      clearTimers();
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [effectiveInterval, paused, offsetMs]);
}
