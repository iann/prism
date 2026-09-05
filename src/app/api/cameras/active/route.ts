import { NextResponse } from 'next/server';
import { getCameraDisplayGrant } from '@/lib/cameras/auth';
import {
  CameraEventStoreUnavailableError,
  getCameraEventSnapshot,
} from '@/lib/cameras/events';
import { getHomeAssistantCameraConfig } from '@/lib/integrations/homeAssistantCameraCredentials';

export const runtime = 'nodejs';

/** Return the short-lived active event snapshot used after an SSE reconnect. */
export async function GET() {
  const grant = await getCameraDisplayGrant();
  if (!grant) return NextResponse.json({ error: 'Camera display enrollment required' }, { status: 401 });

  try {
    const snapshot = await getCameraEventSnapshot(new Set(grant.cameraIds));
    const config = await getHomeAssistantCameraConfig().catch(() => null);
    const names = new Map((config?.cameras ?? []).map((camera) => [camera.id, camera.name]));
    return NextResponse.json({
      ...snapshot,
      events: snapshot.events.map((event) => ({ ...event, cameraName: names.get(event.cameraId) ?? event.cameraId })),
    }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof CameraEventStoreUnavailableError) {
      return NextResponse.json({ error: 'Camera event coordination unavailable' }, { status: 503 });
    }
    console.error('Camera active snapshot failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to read active camera events' }, { status: 500 });
  }
}
