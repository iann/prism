'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ALWAYS_VISIBLE_HREFS,
  filterPortraitNavItems as filterPortraitNavItemsForSelection,
  normalizePortraitNavHrefs,
  PORTRAIT_NAV_PAGES_SETTING_KEY,
} from '@/lib/constants/navItems';
import type { NavItem } from '@/lib/constants/navItems';
import { useFetchOnMount } from './useFetchOnMount';
import { sharedGet } from '@/lib/utils/sharedGet';

const HIDDEN_PAGES_CACHE_KEY = 'prism:hidden-pages';
const PORTRAIT_NAV_CACHE_KEY = 'prism:portrait-nav-pages';

function readCachedHiddenPages(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const cached = localStorage.getItem(HIDDEN_PAGES_CACHE_KEY);
    const parsed = cached ? JSON.parse(cached) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function readCachedPortraitNavPages(): string[] {
  if (typeof window === 'undefined') return normalizePortraitNavHrefs(undefined);
  try {
    const cached = localStorage.getItem(PORTRAIT_NAV_CACHE_KEY);
    return normalizePortraitNavHrefs(cached ? JSON.parse(cached) : undefined);
  } catch {
    return normalizePortraitNavHrefs(undefined);
  }
}

const DOCK_CACHE_KEY = 'prism-dock-pages';

function readCachedDockPages(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(DOCK_CACHE_KEY);
    const v = cached ? JSON.parse(cached) : null;
    return Array.isArray(v) ? v : null;
  } catch { return null; }
}

export function useHiddenPages() {
  const [hiddenPages, setHiddenPagesState] = useState<string[]>(readCachedHiddenPages);
  const [portraitNavPages, setPortraitNavPagesState] = useState<string[]>(readCachedPortraitNavPages);
  // The pages on the dock, in order (#925); null is the default six.
  const [dockPages, setDockPagesState] = useState<string[] | null>(readCachedDockPages);
  const [loaded, setLoaded] = useState(false);

  const fetchHiddenPages = useCallback(async () => {
    try {
      const res = await sharedGet('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const val = data.settings?.hiddenPages;
        if (Array.isArray(val)) {
          setHiddenPagesState(val);
          localStorage.setItem(HIDDEN_PAGES_CACHE_KEY, JSON.stringify(val));
        }
        const portraitNavValue = data.settings?.[PORTRAIT_NAV_PAGES_SETTING_KEY];
        if (Array.isArray(portraitNavValue)) {
          const normalized = normalizePortraitNavHrefs(portraitNavValue);
          setPortraitNavPagesState(normalized);
          localStorage.setItem(PORTRAIT_NAV_CACHE_KEY, JSON.stringify(normalized));
        }
        const dock = data.settings?.dockPages;
        if (Array.isArray(dock)) {
          setDockPagesState(dock);
          localStorage.setItem(DOCK_CACHE_KEY, JSON.stringify(dock));
        }
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useFetchOnMount(fetchHiddenPages);

  const setHiddenPages = useCallback(async (pages: string[]) => {
    setHiddenPagesState(pages);
    localStorage.setItem(HIDDEN_PAGES_CACHE_KEY, JSON.stringify(pages));
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'hiddenPages', value: pages }),
      });
    } catch { /* ignore */ }
  }, []);

  const setPortraitNavPages = useCallback(async (pages: string[]) => {
    const normalized = normalizePortraitNavHrefs(pages);
    setPortraitNavPagesState(normalized);
    localStorage.setItem(PORTRAIT_NAV_CACHE_KEY, JSON.stringify(normalized));
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: PORTRAIT_NAV_PAGES_SETTING_KEY, value: normalized }),
      });
    } catch { /* ignore */ }
  }, []);

  const setDockPages = useCallback(async (pages: string[]) => {
    setDockPagesState(pages);
    localStorage.setItem(DOCK_CACHE_KEY, JSON.stringify(pages));
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'dockPages', value: pages }),
      });
    } catch { /* ignore */ }
  }, []);

  const hiddenSet = useMemo(() => new Set(hiddenPages), [hiddenPages]);
  const portraitNavSet = useMemo(() => new Set(portraitNavPages), [portraitNavPages]);

  const filterNavItems = useCallback(
    (items: NavItem[]): NavItem[] =>
      items.filter(
        (item) => ALWAYS_VISIBLE_HREFS.has(item.href) || !hiddenSet.has(item.href)
      ),
    [hiddenSet]
  );

  const filterPortraitNavItems = useCallback(
    (items: NavItem[]): NavItem[] =>
      filterPortraitNavItemsForSelection(items, portraitNavSet, hiddenSet),
    [hiddenSet, portraitNavSet]
  );

  const isPageHidden = useCallback(
    (href: string): boolean =>
      !ALWAYS_VISIBLE_HREFS.has(href) && hiddenSet.has(href),
    [hiddenSet]
  );

  return {
    hiddenPages,
    portraitNavPages,
    dockPages,
    setDockPages,
    loaded,
    setHiddenPages,
    setPortraitNavPages,
    filterNavItems,
    filterPortraitNavItems,
    isPageHidden,
  };
}
