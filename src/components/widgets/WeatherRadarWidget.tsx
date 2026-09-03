'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import type { WeatherData } from './WeatherWidget';
import { hasPrecipitationInRadarWindow } from '@/lib/weather/precipitation';
import { buildWindyEmbedUrl } from '@/lib/weather/windy';

export type WeatherRadarWidgetProps = {
  data?: WeatherData | null;
  /** Retained for callers from the pre-stack API; positioning is stack-owned. */
  bottomOffset?: number;
};

const RADAR_MAX_SIZE = '32rem';
const RADAR_DISMISSED_UNTIL_KEY = 'prism:weather-radar-dismissed-until';
const RADAR_DISMISS_DURATION_MS = 2 * 60 * 60 * 1000;

function readRadarDismissedUntil(): number | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(RADAR_DISMISSED_UNTIL_KEY);
    if (!stored) return null;

    const dismissedUntil = Number(stored);
    if (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now()) {
      return dismissedUntil;
    }

    localStorage.removeItem(RADAR_DISMISSED_UNTIL_KEY);
  } catch {
    // Storage can be unavailable in private or restricted browsing modes.
  }

  return null;
}

function hasCoordinates(data: WeatherData): data is WeatherData & { lat: number; lon: number } {
  return Number.isFinite(data.lat) && Number.isFinite(data.lon);
}

/** Conditionally surfaces a Windy map over the dashboard when precipitation is nearby. */
export const WeatherRadarWidget = React.memo(function WeatherRadarWidget({
  data,
}: WeatherRadarWidgetProps) {
  const [dismissalReady, setDismissalReady] = React.useState(false);
  const [dismissedUntil, setDismissedUntil] = React.useState<number | null>(null);

  React.useEffect(() => {
    setDismissedUntil(readRadarDismissedUntil());
    setDismissalReady(true);
  }, []);

  React.useEffect(() => {
    if (dismissedUntil === null) return;

    const remainingMs = dismissedUntil - Date.now();
    if (remainingMs <= 0) {
      setDismissedUntil(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDismissedUntil(null);
      try {
        if (Number(localStorage.getItem(RADAR_DISMISSED_UNTIL_KEY)) === dismissedUntil) {
          localStorage.removeItem(RADAR_DISMISSED_UNTIL_KEY);
        }
      } catch {
        // Storage can be unavailable in private or restricted browsing modes.
      }
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [dismissedUntil]);

  const dismissRadar = React.useCallback(() => {
    const nextDismissedUntil = Date.now() + RADAR_DISMISS_DURATION_MS;
    try {
      localStorage.setItem(RADAR_DISMISSED_UNTIL_KEY, String(nextDismissedUntil));
    } catch {
      // Keep the current session dismissed even if persistent storage fails.
    }
    setDismissedUntil(nextDismissedUntil);
  }, []);

  if (!dismissalReady || dismissedUntil !== null) return null;
  if (!data || !hasCoordinates(data) || !hasPrecipitationInRadarWindow(data)) return null;

  return (
    <div
      className="relative z-[10000] aspect-square w-[min(32rem,calc(100vw-2rem))] max-w-full min-w-0 overflow-hidden rounded-xl"
      style={{ maxWidth: RADAR_MAX_SIZE }}
      data-testid="weather-radar-widget"
    >
      <div className="h-full min-h-0 w-full overflow-clip" data-testid="weather-radar-map">
        <iframe
          title="Windy precipitation map"
          src={buildWindyEmbedUrl(data.lat, data.lon)}
          className="block h-full w-full flex-none border-0"
          loading="lazy"
          allowFullScreen
        />
      </div>
      <button
        type="button"
        aria-label="Close weather radar"
        title="Hide weather radar for 2 hours"
        onClick={dismissRadar}
        className="absolute left-2 top-2 z-10 flex h-12 w-12 items-center justify-center bg-transparent text-white drop-shadow-lg transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        data-testid="weather-radar-dismiss"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
});
