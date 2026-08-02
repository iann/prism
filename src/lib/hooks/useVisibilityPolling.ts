'use client';

import { useEffect, useRef } from 'react';
import { usePollingInterval } from './usePollingInterval';

/**
 * Sets up an interval that pauses when the page is hidden and resumes when visible.
 * Automatically refreshes data when the page becomes visible again.
 *
 * The provided interval is automatically stretched when Performance Mode is on
 * (see usePollingInterval). Callers pass their natural default; the hook
 * applies the stretch globally so weak-hardware tuning is centralized.
 *
 * @param callback - Function to call on each interval tick
 * @param intervalMs - Interval in milliseconds (0 or negative to disable)
 */
export function useVisibilityPolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  offsetMs = 0
): void {
  const effectiveInterval = usePollingInterval(intervalMs);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (effectiveInterval <= 0) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
      timeout = null;
      interval = null;
    };

    const runCallback = () => {
      // A slow Raspberry Pi can still be processing a request when the next
      // interval fires. Do not stack another fetch on top of it; the next
      // regular tick will observe the latest data after this one completes.
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      let result: void | Promise<void>;
      try {
        result = callback();
      } catch {
        inFlightRef.current = false;
        return;
      }

      if (!result || typeof (result as Promise<void>).then !== 'function') {
        inFlightRef.current = false;
        return;
      }

      result
        .catch(() => {
          // Fetch hooks report their own errors. This guard prevents a
          // rejected callback from becoming an unhandled promise rejection.
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    };

    const startInterval = () => {
      runCallback();
      interval = setInterval(runCallback, effectiveInterval);
    };

    const resume = () => {
      clearTimers();
      if (offsetMs > 0) {
        timeout = setTimeout(startInterval, offsetMs);
      } else {
        startInterval();
      }
    };

    if (!document.hidden) {
      timeout = setTimeout(startInterval, effectiveInterval + offsetMs);
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimers();
      } else {
        resume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimers();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [effectiveInterval, callback, offsetMs]);
}
