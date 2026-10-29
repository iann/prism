'use client';

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }
  // Older embedded Chromium builds still only have the deprecated listener.
  mediaQuery.addListener(onChange);
  return () => mediaQuery.removeListener(onChange);
}

/** Returns the live OS-level reduced-motion preference only. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}
