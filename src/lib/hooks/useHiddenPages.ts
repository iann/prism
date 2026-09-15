'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ALWAYS_VISIBLE_HREFS,
  filterPortraitNavItems as filterPortraitNavItemsForSelection,
  normalizePortraitNavHrefs,
  PORTRAIT_NAV_PAGES_SETTING_KEY,
} from '@/lib/constants/navItems';
import type { NavItem } from '@/lib/constants/navItems';

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

export function useHiddenPages() {
  const [hiddenPages, setHiddenPagesState] = useState<string[]>(readCachedHiddenPages);
  const [portraitNavPages, setPortraitNavPagesState] = useState<string[]>(readCachedPortraitNavPages);
  const [loaded, setLoaded] = useState(false);

  const fetchHiddenPages = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
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
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    fetchHiddenPages();
  }, [fetchHiddenPages]);

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
    loaded,
    setHiddenPages,
    setPortraitNavPages,
    filterNavItems,
    filterPortraitNavItems,
    isPageHidden,
  };
}
