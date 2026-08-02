'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'prism:week-starts-on';

// Calendar and meals are commonly mounted together. Share the in-flight
// settings request so each hook instance does not create its own identical
// network request during the dashboard's first render.
let settingsRequest: Promise<0 | 1 | null> | null = null;

function loadWeekStartsOn(): Promise<0 | 1 | null> {
  if (settingsRequest) return settingsRequest;

  settingsRequest = fetch('/api/settings')
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      const value = data.settings?.weekStartsOn;
      if (value === '1' || value === 1) return 1;
      if (value === '0' || value === 0 || value !== undefined) return 0;
      return null;
    })
    .catch(() => null)
    .finally(() => {
      settingsRequest = null;
    });

  return settingsRequest;
}

/**
 * Returns the user's preferred first day of the week.
 * 0 = Sunday, 1 = Monday.
 * Reads from settings API on mount, caches in localStorage.
 */
export function useWeekStartsOn(): {
  weekStartsOn: 0 | 1;
  setWeekStartsOn: (value: 0 | 1) => void;
  loading: boolean;
} {
  const [value, setValue] = useState<0 | 1>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === '0' || saved === '1') return Number(saved) as 0 | 1;
    }
    return 0; // Default Sunday
  });
  const [loading, setLoading] = useState(true);

  // Fetch from settings API on mount
  useEffect(() => {
    let cancelled = false;

    loadWeekStartsOn().then((value) => {
      if (!cancelled && value !== null) {
        setValue(value);
        localStorage.setItem(STORAGE_KEY, String(value));
      }
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setWeekStartsOn = useCallback(async (newValue: 0 | 1) => {
    setValue(newValue);
    localStorage.setItem(STORAGE_KEY, String(newValue));
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'weekStartsOn', value: String(newValue) }),
      });
    } catch { /* silent */ }
  }, []);

  return { weekStartsOn: value, setWeekStartsOn, loading };
}

/**
 * Read week-starts-on from localStorage synchronously (for non-hook contexts).
 * Falls back to 0 (Sunday).
 */
export function getWeekStartsOn(): 0 | 1 {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '1') return 1;
  }
  return 0;
}
