import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { homeAssistantFetch, validateConfig } from '@/lib/integrations/homeAssistantCredentials';
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;
  try {
    const c = validateConfig(await request.json());
    const response = await homeAssistantFetch(c, '/api/states');
    if (!response.ok)
      return NextResponse.json(
        { error: 'Home Assistant request failed' },
        { status: response.status === 401 ? 401 : 502 }
      );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connection test failed' },
      { status: 400 }
    );
  }
}
