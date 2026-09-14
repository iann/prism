'use client';

import { useEffect, useState } from 'react';

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Tracks the browser-local calendar date and rolls over at the next midnight. */
export function useLocalDateKey(): string {
  const [dateKey, setDateKey] = useState(() => localDateKey());

  useEffect(() => {
    const update = () => setDateKey(localDateKey());
    update();
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const timeout = setTimeout(
      () => {
        update();
      },
      Math.max(nextMidnight.getTime() - now.getTime(), 1_000)
    );
    return () => clearTimeout(timeout);
  }, [dateKey]);

  return dateKey;
}
