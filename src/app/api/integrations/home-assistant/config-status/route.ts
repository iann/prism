import { NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { getHomeAssistantConfig } from '@/lib/integrations/homeAssistantCredentials';
export async function GET() {
  if (!(await getDisplayAuth())) return NextResponse.json({ configured: false }, { status: 401 });
  const c = await getHomeAssistantConfig();
  return NextResponse.json({
    configured: !!c,
    baseUrl: c?.baseUrl ?? null,
    mediaPlayerEntityId: c?.mediaPlayerEntityId ?? null,
    remoteEntityId: c?.remoteEntityId ?? null,
    hasToken: !!c?.accessToken,
  });
}
