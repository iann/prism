'use client';

import { useCallback, useMemo } from 'react';
import { useFetch } from './useFetch';
import type {
  HomeAssistantMediaPlayerActionInput,
  MediaPlayerService,
  SupportedMediaPlayerControl,
} from '@/lib/integrations/homeAssistantMediaPlayer';

export type MediaPlayerPlaybackData = {
  configured?: boolean;
  active: boolean;
  visible: boolean;
  error?: string;
  entityId: string | null;
  deviceName: string | null;
  state: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  mediaType: string | null;
  appName: string | null;
  mediaService: MediaPlayerService | null;
  series: string | null;
  episode: string | null;
  /** Opaque server-generated identity; raw Home Assistant media IDs never reach the client. */
  mediaIdentity: string | null;
  artworkUrl: string | null;
  position: number | null;
  duration: number | null;
  positionUpdatedAt: string | null;
  endTime: string | null;
  volumeLevel: number | null;
  isVolumeMuted: boolean | null;
  remoteAvailable: boolean;
  supportedControls: SupportedMediaPlayerControl[];
};

export const MEDIA_PLAYER_INITIAL_DATA: MediaPlayerPlaybackData = {
  active: false,
  visible: false,
  entityId: null,
  deviceName: null,
  state: null,
  title: null,
  artist: null,
  album: null,
  mediaType: null,
  appName: null,
  mediaService: null,
  series: null,
  episode: null,
  mediaIdentity: null,
  artworkUrl: null,
  position: null,
  duration: null,
  positionUpdatedAt: null,
  endTime: null,
  volumeLevel: null,
  isVolumeMuted: null,
  remoteAvailable: false,
  supportedControls: [],
};

export function useMediaPlayerPlayback(enabled = true) {
  const result = useFetch<MediaPlayerPlaybackData>({
    url: '/api/integrations/home-assistant/media-player',
    initialData: MEDIA_PLAYER_INITIAL_DATA,
    refreshInterval: 5_000,
    enabled,
    label: 'media-player playback',
  });

  const { refresh } = result;
  const action = useCallback(
    async (input: HomeAssistantMediaPlayerActionInput) => {
      const response = await fetch('/api/integrations/home-assistant/media-player/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || 'Media-player action failed');
      }
      await refresh();
    },
    [refresh]
  );

  return useMemo(() => ({ ...result, action }), [result, action]);
}
