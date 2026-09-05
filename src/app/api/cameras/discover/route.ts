import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import {
  cameraDiscoveryCandidates,
  getHomeAssistantCameraConfig,
  homeAssistantCameraFetch,
  normalizeHomeAssistantCameraUrl,
} from '@/lib/integrations/homeAssistantCameraCredentials';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const body = await request.json() as Record<string, unknown>;
    const stored = await getHomeAssistantCameraConfig();
    const baseUrl = body.baseUrl ?? stored?.baseUrl;
    const accessToken = typeof body.accessToken === 'string' && body.accessToken.trim() ? body.accessToken : stored?.accessToken;
    if (typeof baseUrl !== 'string' || typeof accessToken !== 'string' || !accessToken.trim()) {
      throw new Error('Home Assistant URL and access token are required');
    }
    const config = { baseUrl: normalizeHomeAssistantCameraUrl(baseUrl, 'Home Assistant URL'), accessToken };
    const response = await homeAssistantCameraFetch(config, '/api/states', { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Home Assistant request failed' },
        { status: response.status === 401 ? 401 : 502 },
      );
    }
    return NextResponse.json({ candidates: cameraDiscoveryCandidates(await response.json()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Camera discovery failed' },
      { status: 400 },
    );
  }
}
