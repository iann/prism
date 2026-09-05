import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import {
  clearCameraDisplayCookie,
  createCameraGrant,
  getCameraDisplayGrant,
  listCameraGrants,
  revokeCameraGrant,
  setCameraDisplayCookie,
} from '@/lib/cameras/auth';
import { getHomeAssistantCameraConfig } from '@/lib/integrations/homeAssistantCameraCredentials';

function settingsAuth(auth: Awaited<ReturnType<typeof requireAuth>>) {
  if (auth instanceof NextResponse) return auth;
  return requireRole(auth, 'canModifySettings');
}

export async function GET() {
  const auth = await requireAuth();
  const forbidden = settingsAuth(auth);
  if (forbidden) return forbidden;
  const grants = await listCameraGrants('display');
  return NextResponse.json({ grants });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  const forbidden = settingsAuth(auth);
  if (forbidden) return forbidden;

  try {
    if (auth instanceof NextResponse) return auth;
    const config = await getHomeAssistantCameraConfig();
    if (!config) return NextResponse.json({ error: 'Camera configuration is required first' }, { status: 409 });
    const body = await request.json() as Record<string, unknown>;
    const displayId = typeof body.displayId === 'string' ? body.displayId.trim() : '';
    const requestedIds = body.cameraIds;
    const cameraIds = requestedIds === undefined
      ? config.cameras.filter((camera) => camera.enabled).map((camera) => camera.id)
      : Array.isArray(requestedIds) && requestedIds.every((id) => typeof id === 'string')
        ? requestedIds as string[]
        : [];
    const configuredIds = new Set(config.cameras.filter((camera) => camera.enabled).map((camera) => camera.id));
    if (cameraIds.length === 0 || cameraIds.some((id) => !configuredIds.has(id))) {
      return NextResponse.json({ error: 'Display camera scope is invalid' }, { status: 400 });
    }
    const created = await createCameraGrant({ kind: 'display', cameraIds, displayId, createdBy: auth.userId });
    const previous = await listCameraGrants('display');
    await Promise.all(
      previous
        .filter((grant) => grant.id !== created.grant.id && grant.displayId === displayId && !grant.revokedAt)
        .map((grant) => revokeCameraGrant(grant.id)),
    );
    const response = NextResponse.json({
      grantId: created.grant.id,
      displayId: created.grant.displayId,
      cameraIds: created.grant.cameraIds,
      expiresAt: created.grant.expiresAt,
    });
    setCameraDisplayCookie(response, created.rawToken, created.grant.expiresAt);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to enroll display' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  const forbidden = settingsAuth(auth);
  if (forbidden) return forbidden;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.grantId !== 'string' || !body.grantId) {
      return NextResponse.json({ error: 'grantId is required' }, { status: 400 });
    }
    const current = await getCameraDisplayGrant();
    const revoked = await revokeCameraGrant(body.grantId);
    const response = NextResponse.json({ success: revoked });
    if (current?.id === body.grantId) clearCameraDisplayCookie(response);
    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to revoke display grant' }, { status: 400 });
  }
}
