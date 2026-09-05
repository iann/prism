import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { listCameraGrants, revokeCameraGrant } from '@/lib/cameras/auth';
import { stopActiveCameraStreams } from '@/lib/cameras/sessions';
import {
  deleteHomeAssistantCameraConfig,
  getHomeAssistantCameraConfig,
  homeAssistantCameraFetch,
  redactHomeAssistantCameraConfig,
  saveHomeAssistantCameraConfig,
  validateHomeAssistantCameraConfig,
} from '@/lib/integrations/homeAssistantCameraCredentials';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;
  try {
    return NextResponse.json(redactHomeAssistantCameraConfig(await getHomeAssistantCameraConfig()));
  } catch {
    return NextResponse.json({ error: 'Stored camera configuration is invalid' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const body = await request.json() as Record<string, unknown>;
    const stored = await getHomeAssistantCameraConfig();
    const config = validateHomeAssistantCameraConfig({
      ...body,
      accessToken: typeof body.accessToken === 'string' && body.accessToken.trim() ? body.accessToken : stored?.accessToken,
      go2rtcAccessToken: typeof body.go2rtcAccessToken === 'string' && body.go2rtcAccessToken.trim()
        ? body.go2rtcAccessToken
        : stored?.go2rtcAccessToken ?? null,
    });
    const response = await homeAssistantCameraFetch(config, '/api/states', { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Home Assistant request failed' },
        { status: response.status === 401 ? 401 : 502 },
      );
    }
    await saveHomeAssistantCameraConfig(config);
    return NextResponse.json(redactHomeAssistantCameraConfig(config));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save camera configuration' },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;
  try {
    await stopActiveCameraStreams();
    const grants = await listCameraGrants();
    await Promise.all(grants.filter((grant) => !grant.revokedAt).map((grant) => revokeCameraGrant(grant.id)));
    await deleteHomeAssistantCameraConfig();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Active camera streams must stop before disconnecting' }, { status: 502 });
  }
}
