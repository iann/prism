'use client';

import { useEffect } from 'react';
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
  callback: () => void,
  intervalMs: number,
  offsetMs = 0,
): void {
  const effectiveInterval = usePollingInterval(intervalMs);

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

    const startInterval = () => {
      callback();
      interval = setInterval(callback, effectiveInterval);
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
