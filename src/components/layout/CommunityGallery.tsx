'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { LayoutPreview } from './LayoutPreview';
import {
  getCommunityLayout,
  filterCommunityLayouts,
  type CommunityFilterOptions,
} from '@/lib/community/index';
import type { CommunityIndexEntry } from '@/lib/community/validateLayout';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

interface CommunityGalleryProps {
  mode: 'dashboard' | 'screensaver';
  onApplyLayout: (widgets: WidgetConfig[], name: string) => void;
}

const SCREEN_SIZE_OPTIONS = [
  '1920x1080',
  '2560x1440',
  '3840x2160',
  '2560x1600',
  '2048x1536',
  '1366x768',
];

export function CommunityGallery({ mode, onApplyLayout }: CommunityGalleryProps) {
  const [search, setSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [screenSize, setScreenSize] = useState<string>('');
  const [loading, setLoading] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<CommunityIndexEntry[]>([]);
  const [loadingIndex, setLoadingIndex] = useState(true);

  const filters: CommunityFilterOptions = useMemo(
    () => ({
      mode,
      ...(screenSize ? { screenSize } : {}),
      ...(search ? { search } : {}),
    }),
    [mode, screenSize, search]
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingIndex(true);
    filterCommunityLayouts(filters).then((result) => {
      if (!cancelled) {
        setLayouts(result);
        setLoadingIndex(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const handleUseLayout = useCallback(
    async (entry: CommunityIndexEntry) => {
      setLoading(entry.id);
      try {
        const data = await getCommunityLayout(entry.file);
        if (data) {
          const widgets: WidgetConfig[] = data.widgets.map((w) => ({
            i: w.i,
            type: w.type || w.i,
            x: w.x,
            y: w.y,
            w: w.w,
            h: w.h,
            visible: true,
          }));
          onApplyLayout(widgets, entry.name);
        }
      } finally {
        setLoading(null);
      }
    },
    [onApplyLayout]
  );

  if (loadingIndex) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Loading community layouts...
      </div>
    );
  }

  if (layouts.length === 0) {
    return (
      <div className="space-y-2 py-4 text-center text-sm text-muted-foreground">
        <p>No community layouts found{search ? ` matching "${search}"` : ''}.</p>
        {(search || screenSize) && (
          <button
            onClick={() => {
              setPendingSearch('');
              setSearch('');
              setScreenSize('');
            }}
            className="rounded-md border border-border bg-muted px-3 py-1 text-xs transition-colors hover:bg-accent"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <input
            type="text"
            value={pendingSearch}
            onChange={(e) => {
              setPendingSearch(e.target.value);
              if (!e.target.value) setSearch('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearch(pendingSearch);
            }}
            placeholder="Search layouts... (Enter)"
            className="w-48 rounded-md border border-border bg-muted px-2 py-1 pr-7 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {pendingSearch && (
            <button
              onClick={() => {
                setPendingSearch('');
                setSearch('');
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear search"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {SCREEN_SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              onClick={() => setScreenSize((prev) => (prev === size ? '' : size))}
              className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                screenSize === size
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-muted hover:bg-accent'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Layout cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {layouts.map((entry) => (
          <CommunityLayoutCard
            key={entry.id}
            entry={entry}
            isLoading={loading === entry.id}
            onUse={() => handleUseLayout(entry)}
          />
        ))}
      </div>
    </div>
  );
}

function CommunityLayoutCard({
  entry,
  isLoading,
  onUse,
}: {
  entry: CommunityIndexEntry;
  isLoading: boolean;
  onUse: () => void;
}) {
  const [widgets, setWidgets] = useState<
    Array<{ i: string; type?: string; x: number; y: number; w: number; h: number }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    getCommunityLayout(entry.file).then((data) => {
      if (!cancelled && data) {
        setWidgets(
          data.widgets.map((w) => ({ i: w.i, type: w.type || w.i, x: w.x, y: w.y, w: w.w, h: w.h }))
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [entry.file]);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-2 transition-colors hover:border-primary dark:hover:border-primary/50">
      <LayoutPreview widgets={widgets} width={160} height={100} />
      <div>
        <div className="text-sm font-medium leading-tight">{entry.name}</div>
        <div className="line-clamp-2 text-xs text-muted-foreground">{entry.description}</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">by {entry.author}</span>
          <span className="text-xs text-muted-foreground">{entry.widgetCount} widgets</span>
        </div>
        {entry.screenSizes.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {entry.screenSizes.map((s) => (
              <span
                key={s}
                className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-xs"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onUse}
        disabled={isLoading}
        className="w-full rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isLoading ? 'Loading...' : 'Use Layout'}
      </button>
    </div>
  );
}
