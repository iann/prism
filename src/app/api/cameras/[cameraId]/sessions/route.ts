import { NextRequest, NextResponse } from 'next/server';
import { getCameraDisplayGrant } from '@/lib/cameras/auth';
import {
  CameraSessionError,
  createCameraSession,
  getCameraMapping,
  markCameraCleanupFailed,
  releaseCameraSession,
  sessionErrorStatus,
  startP2PLivestream,
  markCameraCleanupReleased,
  stopP2PLivestream,
  updateCameraSession,
  withCameraStartLock,
} from '@/lib/cameras/sessions';

export const runtime = 'nodejs';

export async function POST(_request: NextRequest, context: { params: Promise<{ cameraId: string }> }) {
  const { cameraId } = await context.params;
  const grant = await getCameraDisplayGrant(cameraId);
  if (!grant) return NextResponse.json({ error: 'Camera display enrollment required' }, { status: 401 });
  try {
    const session = await createCameraSession(cameraId, grant.id);
    try {
      if (session.ownedUpstream) {
        const mapping = await getCameraMapping(cameraId);
        await withCameraStartLock(cameraId, () => startP2PLivestream(mapping));
      }
      const readySession = await updateCameraSession(session.id, grant.id, { state: 'ready' });
      return NextResponse.json({ session: readySession });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Camera stream start failed';
      const released = await releaseCameraSession(session.id, grant.id).catch(() => null);
      await markCameraCleanupFailed(released || session, message).catch(() => undefined);
      if (released?.ownedUpstream) {
        try {
          const mapping = await getCameraMapping(cameraId);
          await withCameraStartLock(cameraId, () => stopP2PLivestream(mapping));
          await markCameraCleanupReleased(released).catch(() => undefined);
        } catch (stopError) {
          await markCameraCleanupFailed(released, stopError instanceof Error ? stopError.message : 'Camera stream cleanup failed').catch(() => undefined);
        }
      }
      if (error instanceof CameraSessionError) throw error;
      throw new CameraSessionError('upstream', message);
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to start camera session' }, { status: sessionErrorStatus(error) });
  }
}
