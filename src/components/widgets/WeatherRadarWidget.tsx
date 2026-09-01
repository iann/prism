'use client';

import * as React from 'react';
import type { WeatherData } from './WeatherWidget';
import { hasPrecipitationInRadarWindow } from '@/lib/weather/precipitation';
import { buildWindyEmbedUrl } from '@/lib/weather/windy';

export type WeatherRadarWidgetProps = {
  data?: WeatherData | null;
  /** Space reserved for portrait navigation or the LCARS footer. */
  bottomOffset?: number;
};

const RADAR_MAX_SIZE = '32rem';

function hasCoordinates(data: WeatherData): data is WeatherData & { lat: number; lon: number } {
  return Number.isFinite(data.lat) && Number.isFinite(data.lon);
}

/** Conditionally surfaces a Windy map over the dashboard when precipitation is nearby. */
export const WeatherRadarWidget = React.memo(function WeatherRadarWidget({
  data,
  bottomOffset = 0,
}: WeatherRadarWidgetProps) {
  if (!data || !hasCoordinates(data) || !hasPrecipitationInRadarWindow(data)) return null;

  const radarSize = `min(calc(100vw - 2rem), calc(100dvh - ${bottomOffset + 32}px), ${RADAR_MAX_SIZE})`;

  return (
    <div
      className="fixed right-4 z-[10000] min-w-0 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl"
      style={{
        width: radarSize,
        height: radarSize,
        bottom: `calc(${bottomOffset + 16}px + env(safe-area-inset-bottom))`,
      }}
      data-testid="weather-radar-widget"
    >
      <div className="h-full min-h-0 w-full overflow-clip" data-testid="weather-radar-map">
        <iframe
          title="Windy precipitation map"
          src={buildWindyEmbedUrl(data.lat, data.lon)}
          className="block h-[calc(100%+8rem)] w-full flex-none border-0"
          loading="lazy"
          allowFullScreen
        />
      </div>
    </div>
  );
});
