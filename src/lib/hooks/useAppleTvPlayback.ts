'use client';

import { useCallback, useMemo } from 'react';
import { useFetch } from './useFetch';
import type {
  HomeAssistantAppleTvActionInput,
  SupportedAppleTvControl,
} from '@/lib/integrations/homeAssistantAppleTv';

export type AppleTvPlaybackData = {
  configured?: boolean;
  active: boolean;
  visible: boolean;
  error?: string;
  deviceName: string | null;
  state: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  mediaType: string | null;
  appName: string | null;
  series: string | null;
  episode: string | null;
  artworkUrl: string | null;
  position: number | null;
  duration: number | null;
  positionUpdatedAt: string | null;
  endTime: string | null;
  volumeLevel: number | null;
  isVolumeMuted: boolean | null;
  supportedControls: SupportedAppleTvControl[];
};

export const APPLE_TV_INITIAL_DATA: AppleTvPlaybackData = {
  active: false,
  visible: false,
  deviceName: null,
  state: null,
  title: null,
  artist: null,
  album: null,
  mediaType: null,
  appName: null,
  series: null,
  episode: null,
  artworkUrl: null,
  position: null,
  duration: null,
  positionUpdatedAt: null,
  endTime: null,
  volumeLevel: null,
  isVolumeMuted: null,
  supportedControls: [],
};

export function useAppleTvPlayback(enabled = true) {
  const result = useFetch<AppleTvPlaybackData>({
    url: '/api/integrations/home-assistant/apple-tv',
    initialData: APPLE_TV_INITIAL_DATA,
    refreshInterval: 5_000,
    enabled,
    label: 'Apple TV playback',
  });

  const { refresh } = result;
  const action = useCallback(
    async (input: HomeAssistantAppleTvActionInput) => {
      const response = await fetch('/api/integrations/home-assistant/apple-tv/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || 'Apple TV action failed');
      }
      await refresh();
    },
    [refresh]
  );

  return useMemo(() => ({ ...result, action }), [result, action]);
}
