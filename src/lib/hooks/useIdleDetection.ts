'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useIsPWA } from './useIsPWA';
import { isScreenCleaningActive, useScreenCleaningActive } from './useScreenCleaning';
import { resolveAwayAutoAfter } from '@/lib/awayMode/autoAfter';
import { isNamedScreen } from '@/lib/displays/namedScreen';

const STORAGE_KEY = 'prism-screensaver-timeout';
const LAST_ACTIVITY_KEY = 'prism-last-activity';
const DEFAULT_TIMEOUT = 120;

function getStoredTimeout(): number {
  if (typeof window === 'undefined') return DEFAULT_TIMEOUT;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored !== null ? Number(stored) : DEFAULT_TIMEOUT;
}

function updateLastActivity() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    } catch {
      // Storage can be disabled by browser policy; the local timer still works.
    }
  }
}

function getLastActivity(): number {
  if (typeof window === 'undefined') return Date.now();
  try {
    const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
    return stored !== null ? Number(stored) : Date.now();
  } catch {
    return Date.now();
  }
}

/** How long after a waking touch its follow-on events are still that tap's. */
export const WAKE_TAP_MS = 600;

const TAP_TAIL = ['pointerup', 'mousedown', 'mouseup', 'click'] as const;

/**
 * Stop the rest of the waking tap (its pointerup, compatibility mouse events
 * and click) from reaching the dashboard under the screensaver. The click ends
 * the tap; a timer ends it if no click comes, so a later tap is never eaten.
 */
function swallowRestOfTap() {
  if (typeof window === 'undefined') return;
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'click') stop();
  };
  const stop = () => {
    clearTimeout(timer);
    TAP_TAIL.forEach((t) => window.removeEventListener(t, swallow, true));
  };
  TAP_TAIL.forEach((t) => window.addEventListener(t, swallow, true));
  const timer = setTimeout(stop, WAKE_TAP_MS);
}

export function useIdleDetection(initialTimeout?: number) {
  const isPWA = useIsPWA();
  const isScreenCleaning = useScreenCleaningActive();
  const [timeout, setTimeoutValue] = useState(() => initialTimeout ?? getStoredTimeout());
  const [isIdle, setIsIdle] = useState(false);
  const isIdleRef = useRef(isIdle);
  const wasScreenCleaningRef = useRef(isScreenCleaning);
  const forcedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awayModeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const awayCheckAbortRef = useRef<AbortController | null>(null);
  const activityCleaningRef = useRef(false);

  useLayoutEffect(() => {
    isIdleRef.current = isIdle;
  }, [isIdle]);

  useLayoutEffect(() => {
    if (isScreenCleaning && !activityCleaningRef.current) updateLastActivity();
    activityCleaningRef.current = isScreenCleaning;
  }, [isScreenCleaning]);

  // Listen for timeout changes from settings
  useEffect(() => {
    const handler = (e: CustomEvent<number>) => {
      setTimeoutValue(e.detail);
    };
    window.addEventListener('prism:screensaver-timeout-change', handler as EventListener);
    return () => window.removeEventListener('prism:screensaver-timeout-change', handler as EventListener);
  }, []);

  // Reset idle timer on user activity (restarts countdown)
  const resetTimer = useCallback((recordActivity = true) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    // The external-store status is synchronous, so this also protects the
    // short interval before React has committed the cleaning-state update.
    if (isScreenCleaningActive()) return;
    // Update last activity for away mode tracking
    if (recordActivity) updateLastActivity();
    if (timeout > 0) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!isScreenCleaningActive()) setIsIdle(true);
      }, timeout * 1000);
    }
  }, [timeout]);

  // Dismiss idle state on deliberate interaction (click, keydown, touch)
  const dismissIdle = useCallback(() => {
    if (!forcedRef.current) {
      setIsIdle(false);
    }
    // After forceIdle, first deliberate interaction clears the flag,
    // second one actually dismisses. This prevents the mouseup from
    // the screensaver button from immediately dismissing.
    if (forcedRef.current) {
      forcedRef.current = false;
      return;
    }
    setIsIdle(false);
    resetTimer();
  }, [resetTimer]);

  const forceIdle = useCallback(() => {
    if (isScreenCleaningActive()) return;
    forcedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setIsIdle(true);
  }, []);

  // Dismissal is registered ALWAYS — including in a PWA, and including when
  // the timeout is "Never".
  //
  // The screensaver can be opened deliberately from the toolbar button, which
  // dispatches 'prism:screensaver' and is not gated on either condition. When
  // this effect skipped registration, that button had no counterpart: nothing
  // anywhere could clear isIdle, so an installed app was stuck on the
  // screensaver until it was force-closed. The auto-idle TIMER below is still
  // skipped on a PWA, which is the documented intent (a phone has no idle
  // state, and auto-locking someone out of their own device is wrong) — but
  // that intent never implied "cannot be dismissed".
  useEffect(() => {
    const maybeDismiss = (e: Event) => {
      // Cleaning temporarily owns touch and key input. Keep the screensaver
      // state intact until its own guarded exit completes.
      if (isScreenCleaningActive()) return;
      // Record activity before the keep-region check, not after it.
      //
      // Activity is otherwise only written by resetTimer(), which dismissIdle()
      // calls — so every interaction that reaches dismissIdle already counted.
      // Taps inside a data-screensaver-keep region return below WITHOUT
      // reaching it, which made the calendar's on-screensaver view controls the
      // one way to use the display without the display noticing. That guard
      // exists so the overlay is not dismissed; it was never meant to mean
      // nobody is standing here.
      updateLastActivity();
      const target = e.target as Element | null;
      if (target && typeof target.closest === 'function' && target.closest('[data-screensaver-keep]')) {
        return;
      }
      // A touch that wakes the screen ends on whatever is under the finger,
      // because the overlay is gone before the touch is over. Without this
      // the same tap that woke the wall also checked off a task (#1112).
      if (e.type === 'touchstart' && isIdleRef.current && !forcedRef.current) {
        swallowRestOfTap();
      }
      dismissIdle();
    };
    const dismissEvents = ['mousedown', 'keydown', 'touchstart'] as const;
    // Passive: none of these call preventDefault, and a non-passive touchstart
    // on window makes the browser wait on JS before it can scroll. Every other
    // activity hook in the codebase already does this.
    dismissEvents.forEach((e) => window.addEventListener(e, maybeDismiss, { passive: true }));
    return () => {
      dismissEvents.forEach((e) => window.removeEventListener(e, maybeDismiss));
    };
  }, [dismissIdle]);

  // A phone has no idle state, so an installed app does not go idle by itself.
  // A screen named in Settings > Screens does, installed or not: installing the
  // app is how a wall tablet runs full-screen, and its screensaver and Away
  // Mode must still start (#1156).
  useEffect(() => {
    const wasScreenCleaning = wasScreenCleaningRef.current;
    wasScreenCleaningRef.current = isScreenCleaning;

    if (isScreenCleaning) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }

    // A cleaning session should not count toward either inactivity clock.
    // When an awake display exits cleaning, treat that as fresh activity even
    // when the screensaver timer is disabled or the display is a PWA.
    const exitedCleaningWhileAwake = wasScreenCleaning && !isIdleRef.current;
    if (exitedCleaningWhileAwake) updateLastActivity();

    if (timeout <= 0 || (isPWA && !isNamedScreen())) return;

    // Mousemove/scroll only reset the idle timer, they don't dismiss the screensaver
    const moveEvents = ['mousemove', 'scroll'] as const;
    const handleMovement = () => resetTimer();
    moveEvents.forEach((e) => window.addEventListener(e, handleMovement, { passive: true }));

    if (!(wasScreenCleaning && isIdleRef.current)) {
      resetTimer(!exitedCleaningWhileAwake);
    }

    return () => {
      moveEvents.forEach((e) => window.removeEventListener(e, handleMovement));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [resetTimer, timeout, isPWA, isScreenCleaning]);

  // Listen for custom screensaver activation event
  useEffect(() => {
    const handler = () => forceIdle();
    window.addEventListener('prism:screensaver', handler);
    return () => window.removeEventListener('prism:screensaver', handler);
  }, [forceIdle]);

  // Away mode auto-activation based on extended inactivity. How long is the
  // household's (#1159), read with the state on every check, so a change in
  // Settings reaches every screen within a minute.
  useEffect(() => {
    if ((isPWA && !isNamedScreen()) || isScreenCleaning) {
      // Stop a check already in flight as soon as cleaning begins. The
      // synchronous guards below cover a check that resolves during cleanup.
      awayCheckAbortRef.current?.abort();
      awayCheckAbortRef.current = null;
      // Clear timer if disabled
      if (awayModeTimerRef.current) {
        clearInterval(awayModeTimerRef.current);
        awayModeTimerRef.current = null;
      }
      return;
    }

    const checkAwayMode = async () => {
      if (isScreenCleaningActive()) return;
      awayCheckAbortRef.current?.abort();
      const controller = new AbortController();
      awayCheckAbortRef.current = controller;
      let postStarted = false;
      try {
        // Ask the server first. Activity is per-browser, but Away Mode is one
        // switch for the whole house, so the decision cannot be made from local
        // state alone: someone turning it off at the wall display has to count
        // against every other client's idle clock, or the most neglected tab in
        // the house wins and turns it straight back on.
        const stateRes = await fetch('/api/away-mode', { signal: controller.signal });
        if (!stateRes.ok) return;
        if (controller.signal.aborted || isScreenCleaningActive()) return;
        const state = await stateRes.json();
        if (controller.signal.aborted || isScreenCleaningActive() || state.enabled) return;
        const awayModeTimeout = await resolveAwayAutoAfter(state);
        if (awayModeTimeout <= 0) return;

        const disabledAt = state.disabledAt ? Date.parse(state.disabledAt) : 0;
        const lastActivity = Math.max(getLastActivity(), Number.isNaN(disabledAt) ? 0 : disabledAt);
        const hoursSinceActivity = (Date.now() - lastActivity) / (1000 * 60 * 60);

        if (hoursSinceActivity >= awayModeTimeout) {
          // Cleaning may have started while the server-state request was in
          // flight. Recheck synchronously at the side-effect boundary.
          if (controller.signal.aborted || isScreenCleaningActive()) return;
          postStarted = true;
          await fetch('/api/away-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true, autoActivated: true }),
          });
          // A request already sent cannot be rolled back by aborting fetch.
          // Let it settle, then refresh shared Away state under the shield.
          // A fresh read avoids publishing a stale snapshot if a manual mode
          // change overlaps this already-sent request.
          window.dispatchEvent(new Event('prism:away-mode-change'));
        }
      } catch {
        // A failed response leaves the server result uncertain; ask the shared
        // Away-mode store to reconcile rather than hiding a possible write.
        if (postStarted) {
          window.dispatchEvent(new Event('prism:away-mode-change'));
        }
        // Ignore errors - away mode is optional
      } finally {
        if (awayCheckAbortRef.current === controller) awayCheckAbortRef.current = null;
      }
    };

    // Check every minute
    awayModeTimerRef.current = setInterval(checkAwayMode, 60 * 1000);
    // Also check immediately
    checkAwayMode();

    return () => {
      awayCheckAbortRef.current?.abort();
      awayCheckAbortRef.current = null;
      if (awayModeTimerRef.current) {
        clearInterval(awayModeTimerRef.current);
        awayModeTimerRef.current = null;
      }
    };
  }, [isPWA, isScreenCleaning]);

  return { isIdle, forceIdle };
}
