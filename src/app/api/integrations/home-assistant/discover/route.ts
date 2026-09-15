import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import {
  getHomeAssistantConfig,
  homeAssistantFetch,
  discoveryCandidates,
} from '@/lib/integrations/homeAssistantCredentials';
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;
  try {
    const body = await request.json();
    const stored = await getHomeAssistantConfig();
    const c = {
      baseUrl: body.baseUrl ?? stored?.baseUrl,
      accessToken: body.accessToken ?? stored?.accessToken,
    };
    if (typeof c.baseUrl !== 'string' || typeof c.accessToken !== 'string')
      throw new Error('URL and access token are required');
    const response = await homeAssistantFetch(c, '/api/states');
    if (!response.ok)
      return NextResponse.json(
        { error: 'Home Assistant request failed' },
        { status: response.status === 401 ? 401 : 502 }
      );
    return NextResponse.json({ candidates: discoveryCandidates(await response.json()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Discovery failed' },
      { status: 400 }
    );
  }
}
