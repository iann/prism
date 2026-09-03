import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import {
  getHomeAssistantConfig,
  homeAssistantFetch,
} from '@/lib/integrations/homeAssistantCredentials';
import {
  estimateHomeAssistantAppleTvPosition,
  normalizeHomeAssistantAppleTvState,
} from '@/lib/integrations/homeAssistantAppleTv';

const empty = () => ({
  active: false,
  visible: false,
  deviceName: null,
  state: null,
  artworkUrl: null,
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
    const normalized = normalizeHomeAssistantAppleTvState(await response.json());
    const estimated = estimateHomeAssistantAppleTvPosition(normalized);
    const active =
      normalized.state === 'playing' ||
      normalized.state === 'paused' ||
      normalized.state === 'buffering';
    const { thumbnail: _thumbnail, ...safeState } = normalized;
    const artworkVersion = normalized.thumbnail
      ? createHash('sha256').update(normalized.thumbnail).digest('hex').slice(0, 12)
      : null;
    // Keep position as Home Assistant reported it at positionUpdatedAt. The client
    // applies the shared estimator once for a smooth timeline between polls.
    return NextResponse.json({
      configured: true,
      ...safeState,
      position: normalized.position,
      endTime: estimated.endTime?.toISOString() ?? null,
      artworkUrl: artworkVersion
        ? `/api/integrations/home-assistant/apple-tv/artwork?v=${artworkVersion}`
        : null,
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
