'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useStoredString, writeStored } from './useStoredValue';

const STORAGE_KEY = 'prism:auto-hide-ui';
const HIDE_DELAY = 10_000; // 10 seconds
const HIDE_REFLOW_GUARD = 750;
const AUTO_HIDE_KEEP_SELECTOR = '[data-auto-hide-keep]';

function isAutoHideKeepTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(AUTO_HIDE_KEEP_SELECTOR) !== null;
}

/**
 * Returns whether the UI (nav + toolbar) should be hidden due to inactivity.
 * Only hides when the feature is enabled in settings.
 */
export function useAutoHideUI() {
  // False during hydration (the server cannot see storage), so the server
  // markup always matches.
  const enabled = useStoredString(STORAGE_KEY) === 'true';
  const [hidden, setHidden] = useState(false);
  const pathname = usePathname();
  // Only auto-hide on dashboard routes (/ and /d/[slug])
  const isDashboard = pathname === '/' || pathname?.startsWith('/d/') === true;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreScrollUntilRef = useRef(0);

  // Only the countdown; showing the UI again is resetTimer's job.
  const armTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Collapsing application chrome can change the document geometry and
      // emit a synthetic scroll event. Treating that reflow as user activity
      // immediately reopens the UI, which is especially visible in LCARS mode.
      ignoreScrollUntilRef.current = Date.now() + HIDE_REFLOW_GUARD;
      setHidden(true);
    }, HIDE_DELAY);
  }, []);

  const resetTimer = useCallback((reveal = true) => {
    if (!enabled) return;
    if (reveal) setHidden(false);
    armTimer();
  }, [enabled, armTimer]);

  const setEnabled = useCallback((value: boolean) => {
    // A timer that fired before the feature was turned off leaves `hidden`
    // true; clear it here so turning the feature back on starts visible.
    setHidden(false);
    writeStored(STORAGE_KEY, String(value));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'] as const;
    const handler = (event: Event) => {
      if (event.type === 'scroll' && Date.now() < ignoreScrollUntilRef.current) return;
      resetTimer(!isAutoHideKeepTarget(event.target));
    };

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));

    // Also reveal on pointer MOVEMENT (throttled). Without this, the hidden
    // toolbar can only be un-hidden by a click — but a click on the collapsed
    // (max-h-0) header lands on the dashboard behind it and never reaches the
    // control the user aimed for, so the first click just "wakes" the UI and
    // seems to do nothing (e.g. the F11 kiosk edit-layout button, #21).
    // Moving toward a control now brings the chrome up before the click.
    // A still cursor emits no mousemove, so idle auto-hide still engages, and
    // a touch-only kiosk (no mousemove) is unaffected.
    let lastMove = 0;
    const moveHandler = (event: MouseEvent) => {
      const now = performance.now();
      if (now - lastMove < 400) return;
      lastMove = now;
      resetTimer(!isAutoHideKeepTarget(event.target));
    };
    window.addEventListener('mousemove', moveHandler, { passive: true });
    // Start the timer immediately. The UI is already showing, so there is
    // nothing to un-hide; only the countdown starts.
    armTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      window.removeEventListener('mousemove', moveHandler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, armTimer, resetTimer]);

  // `hidden` can be left true by a timer that fired before the feature was
  // turned off (in another tab, say); gating on `enabled` here means it never
  // hides the UI then.
  return { autoHideEnabled: enabled, setAutoHideEnabled: setEnabled, uiHidden: enabled && isDashboard && hidden };
}
