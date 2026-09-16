'use client';

import { useState, useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';
import { usePollingInterval } from './usePollingInterval';
import { useCachedMountFetch } from './useCachedMountFetch';
import { navCacheGet, navCacheSet, navCacheDedupe } from '@/lib/utils/navCache';
import { preserveEqual } from '@/lib/utils/preserveEqual';

interface UseFetchOptions<T> {
  url: string;
  initialData: T;
  transform?: (json: unknown) => T;
  refreshInterval?: number;
  refreshOffsetMs?: number;
  label?: string;
  /** Keep the requested polling cadence even when Performance Mode is on. */
  respectPerformanceMode?: boolean;
  /** When false, skip initial fetch and polling. */
  enabled?: boolean;
  /** Keep polling while the screensaver is up. */
  pollWhileIdle?: boolean;
}

interface UseFetchResult<T> {
  data: T;
  setData: Dispatch<SetStateAction<T>>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Do not refetch a second live instance that mounted shortly after the first. */
const POLL_REUSE_RATIO = 0.5;

export function useFetch<T>(options: UseFetchOptions<T>): UseFetchResult<T> {
  const {
    url,
    initialData,
    transform,
    refreshInterval = 0,
    refreshOffsetMs = 0,
    label = 'data',
    respectPerformanceMode = true,
    enabled = true,
    pollWhileIdle = false,
  } = options;

  const transformRef = useRef(transform);
  transformRef.current = transform;
  const labelRef = useRef(label);
  labelRef.current = label;

  // A cached value younger than this hook's own interval is as fresh as a poll
  // that had remained mounted, so a remount can adopt it without a request.
  const maxAgeMs = usePollingInterval(refreshInterval);
  const cached = navCacheGet<T>(url, maxAgeMs);
  const [data, setDataState] = useState<T>(() => cached ?? initialData);
  const dataRef = useRef(data);
  dataRef.current = data;
  const setData: Dispatch<SetStateAction<T>> = useCallback((update) => {
    setDataState((current) => {
      const next = typeof update === 'function'
        ? (update as (value: T) => T)(current)
        : update;
      dataRef.current = next;
      return next;
    });
  }, []);

  const [loadingState, setLoadingState] = useState(enabled && !cached);
  const loadingRef = useRef(loadingState);
  loadingRef.current = loadingState;
  const setLoading = useCallback((next: boolean) => {
    if (loadingRef.current === next) return;
    loadingRef.current = next;
    setLoadingState(next);
  }, []);
  const [errorState, setErrorState] = useState<string | null>(null);
  const errorRef = useRef(errorState);
  errorRef.current = errorState;
  const setError = useCallback((next: string | null) => {
    if (errorRef.current === next) return;
    errorRef.current = next;
    setErrorState(next);
  }, []);

  // Once a URL has loaded, polling stays stale-while-revalidate even when the
  // cache entry ages past the short navigation window.
  const loadedUrlRef = useRef<string | null>(cached ? url : null);

  const applyResult = useCallback((result: T) => {
    loadedUrlRef.current = url;
    const next = preserveEqual(dataRef.current, result);
    if (next !== dataRef.current) {
      dataRef.current = next;
      setDataState(next);
    }
    setLoading(false);
  }, [url, setLoading]);

  const fetchData = useCallback(async (opts?: { force?: boolean }) => {
    // Several live instances can share a poll. Explicit refreshes still go to
    // the network because they are asking about a known mutation.
    if (!opts?.force && maxAgeMs > 0) {
      const justFetched = navCacheGet<T>(url, maxAgeMs * POLL_REUSE_RATIO);
      if (justFetched !== undefined) {
        applyResult(justFetched);
        return;
      }
    }

    if (loadedUrlRef.current !== url && !navCacheGet(url, maxAgeMs)) setLoading(true);
    try {
      setError(null);
      const json = await navCacheDedupe(url, async () => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${labelRef.current}`);
        return response.json();
      });
      const result = transformRef.current ? transformRef.current(json as never) : (json as T);
      navCacheSet(url, result);
      applyResult(result);
    } catch (err) {
      console.error(`Error fetching ${labelRef.current}:`, err);
      setError(err instanceof Error ? err.message : `Failed to fetch ${labelRef.current}`);
    } finally {
      setLoading(false);
    }
  }, [url, maxAgeMs, applyResult, setError, setLoading]);

  useCachedMountFetch<T>({
    key: url,
    enabled,
    maxAgeMs,
    fetch: fetchData,
    adopt: applyResult,
  });

  useVisibilityPolling(
    fetchData,
    enabled ? refreshInterval : 0,
    refreshOffsetMs,
    respectPerformanceMode,
  );

  const refresh = useCallback(() => fetchData({ force: true }), [fetchData]);

  return { data, setData, loading: loadingState, error: errorState, refresh };
}
