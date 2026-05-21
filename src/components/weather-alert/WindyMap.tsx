'use client';

/**
 * Windy.com embedded weather map.
 *
 * Renders an iframe pointing to embed.windy.com with the configured overlay
 * centred on the alert zone. Windy shows live lightning strike markers on top
 * of any overlay layer automatically when strikes are occurring.
 *
 * Overlay options (set via NEXT_PUBLIC_WINDY_OVERLAY):
 *   radar     — Doppler radar precipitation (default)
 *   thunder   — Thunderstorm probability (CAPE-derived)
 *   lightning — Lightning strike density
 *   wind      — Wind speed and gusts
 *
 * No API key required. No client-side JS dependencies.
 */

const DEFAULT_OVERLAY = process.env.NEXT_PUBLIC_WINDY_OVERLAY ?? 'radar';

export interface WindyMapProps {
  center: [number, number];
  zoom?: number;
  overlay?: string;
}

export function WindyMap({ center, zoom = 7, overlay = DEFAULT_OVERLAY }: WindyMapProps) {
  const [lat, lon] = center;

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    detailLat: String(lat),
    detailLon: String(lon),
    zoom: String(zoom),
    level: 'surface',
    overlay,
    product: 'ecmwf',
    menu: '',
    message: '',
    marker: '',
    calendar: 'now',
    pressure: '',
    type: 'map',
    location: 'coordinates',
    detail: '',
    metricWind: 'mph',
    metricTemp: '°F',
    radarRange: '-1',
  });

  const src = `https://embed.windy.com/embed2.html?${params.toString()}`;

  return (
    <iframe
      src={src}
      className="w-full h-full border-0"
      title="Live weather radar"
      aria-hidden="true"
      allowFullScreen
    />
  );
}
