import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import {
  deleteHomeAssistantConfig,
  homeAssistantFetch,
  saveHomeAssistantConfig,
  validateConfig,
} from '@/lib/integrations/homeAssistantCredentials';
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;
  try {
    const c = validateConfig(await request.json());
    const r = await homeAssistantFetch(c, '/api/states');
    if (!r.ok)
      return NextResponse.json(
        { error: 'Home Assistant request failed' },
        { status: r.status === 401 ? 401 : 502 }
      );
    await saveHomeAssistantConfig(c);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save configuration' },
      { status: 400 }
    );
  }
}
export async function DELETE() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;
  await deleteHomeAssistantConfig();
  return NextResponse.json({ success: true });
}
