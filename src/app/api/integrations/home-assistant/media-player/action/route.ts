import { NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import {
  getHomeAssistantConfig,
  homeAssistantFetch,
  validateEntity,
} from '@/lib/integrations/homeAssistantCredentials';
import {
  buildHomeAssistantMediaPlayerActionRequests,
  normalizeHomeAssistantMediaPlayerState,
  type HomeAssistantMediaPlayerActionInput,
} from '@/lib/integrations/homeAssistantMediaPlayer';

export async function POST(request: Request) {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (auth.scopes !== undefined && !auth.scopes.includes('*')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const config = await getHomeAssistantConfig();
  if (!config) return NextResponse.json({ error: 'Media player is not configured' }, { status: 409 });
  try {
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== 'object' ||
      typeof (body as { control?: unknown }).control !== 'string'
    )
      throw new Error('Invalid media-player action');
    const input = body as HomeAssistantMediaPlayerActionInput;
    const stateResponse = await homeAssistantFetch(
      config,
      `/api/states/${encodeURIComponent(config.mediaPlayerEntityId)}`
    );
    if (!stateResponse.ok)
      return NextResponse.json({ error: 'Unable to validate media-player state' }, { status: 502 });
    const state = normalizeHomeAssistantMediaPlayerState(await stateResponse.json());
    if (!state.supportedControls.includes(input.control as never))
      return NextResponse.json({ error: 'Media-player action is not supported' }, { status: 400 });
    const requests = buildHomeAssistantMediaPlayerActionRequests(
      {
        ...input,
        ...(input.control === 'turn_off' ? { remoteEntityId: config.remoteEntityId } : {}),
      },
      validateEntity(config.mediaPlayerEntityId, 'media_player')
    );
    for (const [i, service] of requests.entries()) {
      const response = await homeAssistantFetch(
        config,
        `/api/services/${service.domain}/${service.service}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(service.data),
        }
      );
      if (!response.ok)
        return NextResponse.json(
          {
            success: false,
            partial: i > 0,
            failedRequest: service.requestId ?? i,
            error: 'Home Assistant action failed',
          },
          { status: 502 }
        );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid media-player action' },
      { status: 400 }
    );
  }
}
