import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import {
  getHomeAssistantCameraConfig,
  redactHomeAssistantCameraConfig,
} from '@/lib/integrations/homeAssistantCameraCredentials';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;
  const config = await getHomeAssistantCameraConfig();
  return NextResponse.json({
    ...redactHomeAssistantCameraConfig(config),
    status: config?.enabled ? 'configured' : config ? 'disabled' : 'unconfigured',
  });
}
