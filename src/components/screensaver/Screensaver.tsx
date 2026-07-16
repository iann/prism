'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';
import { useAutoOrientationSetting, usePinnedPhoto, useScreensaverInterval } from '@/components/layout/WallpaperBackground';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import { useDashboardData } from '@/components/dashboard/useDashboardData';
import { buildWidgetProps } from '@/components/dashboard/useWidgetProps';
import { GRID_COLS } from '@/lib/constants/grid';
import { CssGridDisplay } from '@/components/layout/grid/CssGridDisplay';
import { loadScreensaverLayout } from './screensaverStorage';

// Re-export storage utilities for consumers
export {
  DEFAULT_SCREENSAVER_LAYOUT,
  loadScreensaverLayout,
  saveScreensaverLayout,
  getScreensaverPresets,
  saveScreensaverPreset,
  deleteScreensaverPreset,
} from './screensaverStorage';

export function Screensaver() {
  const { enabled: performanceMode } = usePerformanceMode();
  const { enabled: autoOrientation } = useAutoOrientationSetting();
  const { pinnedId } = usePinnedPhoto('screensaver');
  const { interval: screensaverInterval } = useScreensaverInterval();
  const screenOrientation = useScreenOrientation();
  const orientationOverride = typeof window !== 'undefined'
    ? (localStorage.getItem('prism-orientation-override') as 'landscape' | 'portrait' | null) || null
    : null;
  const effectiveOrientation = orientationOverride || screenOrientation;
  const { photos } = usePhotos({
    sort: 'random',
    limit: performanceMode ? 1 : 50,
    usage: 'screensaver',
    orientation: autoOrientation ? effectiveOrientation : undefined,
  });
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  // Only rotate if no pinned photo and interval is not "never" (0)
  useEffect(() => {
    if (photos.length <= 1 || pinnedId || screensaverInterval === 0) return;
    const timer = setInterval(() => {
      setFadingOut(true);
      setTimeout(() => {
        setCurrentIndex((i) => (i + 1) % photos.length);
        setFadingOut(false);
      }, 1000);
    }, screensaverInterval * 1000);
    return () => clearInterval(timer);
  }, [photos.length, pinnedId, screensaverInterval]);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Use pinned photo if set, otherwise use rotating photos
  const src = pinnedId
    ? `/api/photos/${pinnedId}/file${performanceMode ? '?thumb=1' : ''}`
    : photos[currentIndex]
      ? `/api/photos/${photos[currentIndex]!.id}/file${performanceMode ? '?thumb=1' : ''}`
      : '';

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black transition-opacity duration-1000 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {src && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
          style={{
            backgroundImage: `url(${src})`,
            opacity: fadingOut ? 0 : 1,
          }}
        />
      )}
      <div className="absolute inset-0 bg-black/40" />
      <ScreensaverGrid />
    </div>
  );
}

function ScreensaverGrid() {
  const layout = useMemo(() => loadScreensaverLayout(), []);
  const visibleWidgets = useMemo(
    () => new Set(layout.filter(widget => widget.visible !== false).map(widget => widget.i)),
    [layout],
  );
  const data = useDashboardData(visibleWidgets);
  const widgetProps = useMemo(() =>
    buildWidgetProps(
      data,
      async () => null, // no auth in screensaver
      { setShowAddTask: () => {}, setShowAddMessage: () => {}, setShowAddChore: () => {}, setShowAddShopping: () => {} },
      '',
    ),
  [data]);

  const renderWidget = (w: WidgetConfig) => {
    const reg = WIDGET_REGISTRY[w.i];
    if (!reg) return null;
    const Component = reg.component;
    const rawProps = { ...widgetProps[w.i] || {}, gridW: w.w, gridH: w.h };
    // Strip interactive callbacks — screensaver widgets are display-only
    const {
      onAddClick, onAddMeal, onListChange, onItemToggle, onTaskToggle,
      onChoreComplete, onEventClick, onMessageClick, onDeleteClick,
      onMarkCooked, onUnmarkCooked,
      ...props
    } = rawProps as Record<string, unknown>;
    return (
      <React.Suspense fallback={<div className="flex items-center justify-center h-full opacity-50 text-sm">Loading...</div>}>
        <div className="h-full w-full [&_*:not([data-keep-bg]):not([data-keep-bg]_*)]:!bg-transparent [&_.bg-card]:!bg-white/10 [&_.border-border]:!border-white/20">
          <Component {...props} />
        </div>
      </React.Suspense>
    );
  };

  // Override renderWidget to inject screensaver text defaults (white text)
  const renderScreensaverWidget = (w: WidgetConfig) => {
    return renderWidget({
      ...w,
      textColor: w.textColor || '#FFFFFF',
      textOpacity: w.textOpacity ?? (w.textColor ? 1 : 0.9),
    });
  };

  return (
    <CssGridDisplay
      layout={layout}
      renderWidget={renderScreensaverWidget}
      margin={4}
      containerPadding={12}
      cols={GRID_COLS}
      fillHeight
      className="w-full h-full"
    />
  );
}

export { ScreensaverGrid };
