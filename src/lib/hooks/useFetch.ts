'use client';

import { useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';
import { navCacheGet, navCacheSet } from '@/lib/utils/navCache';
import { preserveEqual } from '@/lib/utils/preserveEqual';

interface UseFetchOptions<T> {
  url: string;
  initialData: T;
  transform?: (json: unknown) => T;
  refreshInterval?: number;
  refreshOffsetMs?: number;
  label?: string;
  /** When false, skip initial fetch and polling. Fetch triggers when enabled transitions to true. */
  enabled?: boolean;
}

interface UseFetchResult<T> {
  data: T;
  setData: Dispatch<SetStateAction<T>>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFetch<T>(options: UseFetchOptions<T>): UseFetchResult<T> {
  const { url, initialData, transform, refreshInterval = 0, refreshOffsetMs = 0, label = 'data', enabled = true } = options;

  const transformRef = useRef(transform);
  transformRef.current = transform;
  const labelRef = useRef(label);
  labelRef.current = label;

  // Seed state from navigation cache so the page renders immediately on revisit
  const cached = navCacheGet<T>(url);
  const [data, setDataState] = useState<T>(() => cached ?? initialData);
  const dataRef = useRef(data);
  dataRef.current = data;
  const setData: Dispatch<SetStateAction<T>> = useCallback((update) => {
    setDataState(current => {
      const next = typeof update === 'function'
        ? (update as (value: T) => T)(current)
        : update;
      dataRef.current = next;
      return next;
    });
  }, []);
  const [loading, setLoadingState] = useState(enabled && !cached);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const setLoading = useCallback((next: boolean) => {
    if (loadingRef.current === next) return;
    loadingRef.current = next;
    setLoadingState(next);
  }, []);
  const [error, setErrorState] = useState<string | null>(null);
  const errorRef = useRef(error);
  errorRef.current = error;
  const setError = useCallback((next: string | null) => {
    if (errorRef.current === next) return;
    errorRef.current = next;
    setErrorState(next);
  }, []);
  const hasDataRef = useRef(cached !== undefined);

  const fetchData = useCallback(async () => {
    if (!hasDataRef.current) setLoading(true);
    try {
      setError(null);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${labelRef.current}`);
      const json = await response.json();
      const result = transformRef.current ? transformRef.current(json) : (json as T);
      navCacheSet(url, result);
      hasDataRef.current = true;
      const next = preserveEqual(dataRef.current, result);
      if (next !== dataRef.current) {
        dataRef.current = next;
        setDataState(next);
      }
    } catch (err) {
      console.error(`Error fetching ${labelRef.current}:`, err);
      setError(err instanceof Error ? err.message : `Failed to fetch ${labelRef.current}`);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (enabled) fetchData();
  }, [fetchData, enabled]);

  useVisibilityPolling(fetchData, enabled ? refreshInterval : 0, refreshOffsetMs);

  return { data, setData, loading, error, refresh: fetchData };
}
