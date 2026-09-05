import { NextRequest, NextResponse } from 'next/server';
import { validateCameraIngressRequest } from '@/lib/cameras/auth';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import {
  acceptCameraEvent,
  CAMERA_EVENT_BODY_LIMIT,
  CameraEventStoreUnavailableError,
  CameraEventValidationError,
  validateCameraEvent,
} from '@/lib/cameras/events';

export const runtime = 'nodejs';

/**
 * Machine-to-machine Home Assistant ingress. The bearer is a camera-specific
 * grant, never a general Prism API token or browser session.
 */
export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > CAMERA_EVENT_BODY_LIMIT) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  let payload: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > CAMERA_EVENT_BODY_LIMIT) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const event = validateCameraEvent(payload);
    const grant = await validateCameraIngressRequest(event.cameraId);
    if (!grant) return NextResponse.json({ error: 'Camera ingress authorization required' }, { status: 401 });
    const limited = await rateLimitGuard(`camera-ingress:${grant.id}`, 'camera-events', 120, 60);
    if (limited) return limited;
    const result = await acceptCameraEvent(event, grant.id);
    if (!result.accepted) {
      return NextResponse.json(
        { error: 'eventId was previously used with different contents', revision: result.snapshot.revision },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        accepted: true,
        duplicate: result.duplicate,
        revision: result.snapshot.revision,
        eventId: event.eventId,
      },
      { status: result.duplicate ? 200 : 202 },
    );
  } catch (error) {
    if (error instanceof CameraEventValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof CameraEventStoreUnavailableError) {
      return NextResponse.json({ error: 'Camera event coordination unavailable' }, { status: 503 });
    }
    console.error('Camera event ingress failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to accept camera event' }, { status: 500 });
  }
}
