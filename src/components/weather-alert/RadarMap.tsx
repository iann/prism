'use client';

/**
 * Animated live radar map powered by RainViewer (free, no API key).
 *
 * Import this component only via next/dynamic with ssr:false — Leaflet
 * requires window and will throw during SSR.
 *
 * The component:
 *  1. Initialises a Leaflet map with a dark CartoDB base layer.
 *  2. Fetches the available radar frames from the RainViewer public API.
 *  3. Cycles through the past frames in a loop at FRAME_INTERVAL_MS.
 */

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

const FRAME_INTERVAL_MS = 500;

interface RainViewerFrame {
  path: string;
  time: number;
}

export interface RadarMapProps {
  center: [number, number];
  zoom?: number;
}

export function RadarMap({ center, zoom = 7 }: RadarMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let map: import('leaflet').Map | null = null;
    let radarLayer: import('leaflet').TileLayer | null = null;
    let animInterval: ReturnType<typeof setInterval> | null = null;
    let destroyed = false;

    (async () => {
      const L = await import('leaflet');
      if (destroyed || !containerRef.current) return;

      map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: false,
        attributionControl: false,
      });

      // Dark base map
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // Fetch RainViewer frame list
      let frames: RainViewerFrame[] = [];
      let host = 'https://tilecache.rainviewer.com';
      try {
        const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data = await res.json() as {
          host?: string;
          radar?: { past?: RainViewerFrame[] };
        };
        host = data.host ?? host;
        frames = data.radar?.past ?? [];
      } catch {
        // RainViewer unavailable — map still shows base tiles
      }

      if (destroyed || !frames.length) return;

      let frameIndex = 0;

      const showFrame = () => {
        frameIndex = (frameIndex + 1) % frames.length;
        const frame = frames[frameIndex]!;
        const url = `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;

        if (radarLayer && map) map.removeLayer(radarLayer);
        radarLayer = L.tileLayer(url, { opacity: 0.7, maxZoom: 19 });
        if (map) radarLayer.addTo(map);
      };

      // Show first frame immediately, then animate
      showFrame();
      animInterval = setInterval(showFrame, FRAME_INTERVAL_MS);
    })();

    return () => {
      destroyed = true;
      if (animInterval) clearInterval(animInterval);
      if (map) map.remove();
    };
  }, [center, zoom]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      aria-hidden="true"
    />
  );
}
