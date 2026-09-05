import { NextRequest, NextResponse } from 'next/server';
import { getCameraDisplayGrant } from '@/lib/cameras/auth';
import { getCameraMapping, markCameraCleanupFailed, markCameraCleanupReleased, releaseCameraSession, sessionErrorStatus, updateCameraSession, stopP2PLivestream, withCameraStartLock } from '@/lib/cameras/sessions';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const body = await request.json().catch(() => ({})) as { cameraId?: unknown };
  if (typeof body.cameraId !== 'string') return NextResponse.json({ error: 'cameraId is required' }, { status: 400 });
  const grant = await getCameraDisplayGrant(body.cameraId);
  if (!grant) return NextResponse.json({ error: 'Camera display enrollment required' }, { status: 401 });
  try {
    return NextResponse.json({ session: await updateCameraSession(sessionId, grant.id, { state: 'ready' }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to renew camera session' }, { status: sessionErrorStatus(error) });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const body = await request.json().catch(() => ({})) as { cameraId?: unknown };
  if (typeof body.cameraId !== 'string') return NextResponse.json({ error: 'cameraId is required' }, { status: 400 });
  const grant = await getCameraDisplayGrant(body.cameraId);
  if (!grant) return NextResponse.json({ error: 'Camera display enrollment required' }, { status: 401 });
  try {
    const session = await releaseCameraSession(sessionId, grant.id);
    if (session?.ownedUpstream) {
      try {
        const mapping = await getCameraMapping(body.cameraId);
        await withCameraStartLock(body.cameraId, () => stopP2PLivestream(mapping));
        await markCameraCleanupReleased(session);
      } catch (stopError) {
        await markCameraCleanupFailed(session, stopError instanceof Error ? stopError.message : 'Camera stream stop failed').catch(() => undefined);
        throw stopError;
      }
    }
    return NextResponse.json({ released: Boolean(session) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to release camera session' }, { status: sessionErrorStatus(error) });
  }
}
