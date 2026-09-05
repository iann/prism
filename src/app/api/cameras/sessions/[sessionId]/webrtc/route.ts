import { NextRequest, NextResponse } from 'next/server';
import { getCameraDisplayGrant } from '@/lib/cameras/auth';
import { getHomeAssistantCameraConfig } from '@/lib/integrations/homeAssistantCameraCredentials';
import { getCameraSession, sessionErrorStatus } from '@/lib/cameras/sessions';
import { safeFetch } from '@/lib/utils/safeFetch';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  let session;
  try {
    session = await getCameraSession(sessionId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Camera session unavailable' }, { status: sessionErrorStatus(error) });
  }
  if (!session) return NextResponse.json({ error: 'Camera session not found' }, { status: 404 });
  if (session.state !== 'ready') return NextResponse.json({ error: 'Camera session is not ready' }, { status: 409 });
  if (Date.parse(session.hardDeadline) <= Date.now()) return NextResponse.json({ error: 'Camera session expired' }, { status: 410 });
  const grant = await getCameraDisplayGrant(session.cameraId);
  if (!grant || grant.id !== session.grantId) return NextResponse.json({ error: 'Camera display enrollment required' }, { status: 401 });
  const body = await request.text();
  if (body.length > 128 * 1024) return NextResponse.json({ error: 'SDP offer is too large' }, { status: 413 });
  let offer: unknown;
  try { offer = JSON.parse(body); } catch { return NextResponse.json({ error: 'Invalid SDP offer' }, { status: 400 }); }
  if (!offer || typeof offer !== 'object' || (offer as { type?: unknown }).type !== 'offer' || typeof (offer as { sdp?: unknown }).sdp !== 'string') {
    return NextResponse.json({ error: 'A JSON WebRTC offer is required' }, { status: 400 });
  }
  const config = await getHomeAssistantCameraConfig();
  if (!config?.go2rtcBaseUrl) return NextResponse.json({ error: 'go2rtc is not configured' }, { status: 503 });
  try {
    const response = await safeFetch(`${config.go2rtcBaseUrl}/api/webrtc?src=${encodeURIComponent(session.alias)}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(config.go2rtcAccessToken ? { Authorization: `Bearer ${config.go2rtcAccessToken}` } : {}),
      },
      body,
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return NextResponse.json({ error: 'go2rtc could not negotiate the camera stream' }, { status: 502 });
    return new NextResponse(await response.text(), { status: response.status, headers: { 'Content-Type': response.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'WebRTC negotiation failed' }, { status: sessionErrorStatus(error) });
  }
}
