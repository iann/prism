import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import {
  getHomeAssistantConfig,
  homeAssistantFetch,
} from '@/lib/integrations/homeAssistantCredentials';
import {
  estimateHomeAssistantMediaPlayerPosition,
  normalizeHomeAssistantMediaPlayerState,
} from '@/lib/integrations/homeAssistantMediaPlayer';
import { buildHomeAssistantMediaIdentity } from '@/lib/integrations/homeAssistantMediaPlayerIdentity';

const empty = () => ({
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
});

export async function GET() {
  if (!(await getDisplayAuth()))
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const config = await getHomeAssistantConfig();
  if (!config) return NextResponse.json(empty());
  try {
    const response = await homeAssistantFetch(
      config,
      `/api/states/${encodeURIComponent(config.mediaPlayerEntityId)}`
    );
    if (!response.ok)
      return NextResponse.json(
        { configured: true, ...empty(), error: 'Home Assistant request failed' },
        { status: 502 }
      );
    const normalized = normalizeHomeAssistantMediaPlayerState(await response.json());
    const estimated = estimateHomeAssistantMediaPlayerPosition(normalized);
    const active =
      normalized.state === 'playing' ||
      normalized.state === 'paused' ||
      normalized.state === 'buffering';
    const { thumbnail: _thumbnail, mediaContentId: _mediaContentId, ...safeState } = normalized;
    const artworkVersion = normalized.thumbnail
      ? createHash('sha256').update(normalized.thumbnail).digest('hex').slice(0, 12)
      : null;
    // Keep position as Home Assistant reported it at positionUpdatedAt. The client
    // applies the shared estimator once for a smooth timeline between polls.
    return NextResponse.json({
      configured: true,
      ...safeState,
      mediaIdentity: buildHomeAssistantMediaIdentity(normalized),
      position: normalized.position,
      endTime: estimated.endTime?.toISOString() ?? null,
      artworkUrl: artworkVersion
        ? `/api/integrations/home-assistant/media-player/artwork?v=${artworkVersion}`
        : null,
      remoteAvailable: !!config.remoteEntityId,
      active,
      visible:
        active &&
        !!(
          normalized.title ||
          normalized.series ||
          normalized.episode ||
          normalized.artist ||
          normalized.album ||
          normalized.appName
        ),
    });
  } catch {
    return NextResponse.json(
      { configured: true, ...empty(), error: 'Home Assistant unavailable' },
      { status: 502 }
    );
  }
}
