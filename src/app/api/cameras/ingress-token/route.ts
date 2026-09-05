import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { createCameraGrant, listCameraGrants, revokeCameraGrant } from '@/lib/cameras/auth';
import { getHomeAssistantCameraConfig } from '@/lib/integrations/homeAssistantCameraCredentials';

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  const config = await getHomeAssistantCameraConfig();
  if (!config) return NextResponse.json({ error: 'Camera configuration is required first' }, { status: 409 });
  const cameraIds = config.cameras.filter((camera) => camera.enabled).map((camera) => camera.id);
  if (cameraIds.length === 0) return NextResponse.json({ error: 'Enable at least one camera first' }, { status: 409 });

  const created = await createCameraGrant({ kind: 'event-ingress', cameraIds, createdBy: auth.userId });
  // Rotation is explicit: leave the newly-created grant usable, then revoke
  // every older active ingress grant so a copied HA secret cannot remain valid.
  const previous = await listCameraGrants('event-ingress');
  await Promise.all(
    previous
      .filter((grant) => grant.id !== created.grant.id && !grant.revokedAt)
      .map((grant) => revokeCameraGrant(grant.id)),
  );
  return NextResponse.json({
    grantId: created.grant.id,
    cameraIds: created.grant.cameraIds,
    expiresAt: created.grant.expiresAt,
    token: created.rawToken,
  });
}
