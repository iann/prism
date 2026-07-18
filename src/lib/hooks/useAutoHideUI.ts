'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'prism:auto-hide-ui';
const HIDE_DELAY = 10_000; // 10 seconds
const HIDE_REFLOW_GUARD = 750;

/**
 * Returns whether the UI (nav + toolbar) should be hidden due to inactivity.
 * Only hides when the feature is enabled in settings.
 */
export function useAutoHideUI() {
  const [enabled, setEnabledState] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  // Only auto-hide on dashboard routes (/ and /d/[slug])
  const isDashboard = pathname === '/' || pathname.startsWith('/d/');

  // Read from localStorage after mount to avoid SSR hydration mismatch
  useEffect(() => {
    setEnabledState(localStorage.getItem(STORAGE_KEY) === 'true');
    setMounted(true);
  }, []);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreScrollUntilRef = useRef(0);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    setHidden(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Collapsing application chrome can change the document geometry and
      // emit a synthetic scroll event. Treating that reflow as user activity
      // immediately reopens the UI, which is especially visible in LCARS mode.
      ignoreScrollUntilRef.current = Date.now() + HIDE_REFLOW_GUARD;
      setHidden(true);
    }, HIDE_DELAY);
  }, [enabled]);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    localStorage.setItem(STORAGE_KEY, String(value));
    if (!value) {
      setHidden(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'] as const;
    const handler = (event: Event) => {
      if (event.type === 'scroll' && Date.now() < ignoreScrollUntilRef.current) return;
      resetTimer();
    };

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    // Start the timer immediately
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, resetTimer]);

  // Listen for cross-component setting changes
  useEffect(() => {
    const handler = () => {
      const val = localStorage.getItem(STORAGE_KEY) === 'true';
      setEnabledState(val);
      if (!val) setHidden(false);
    };
    window.addEventListener('storage', handler);
    window.addEventListener('prism:auto-hide-change', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('prism:auto-hide-change', handler);
    };
  }, []);

  return {
    autoHideEnabled: enabled,
    setAutoHideEnabled: setEnabled,
    uiHidden: mounted && enabled && isDashboard && hidden,
  };
}
