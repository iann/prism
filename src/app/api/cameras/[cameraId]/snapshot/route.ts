import { NextResponse } from 'next/server';
import { getCameraDisplayGrant } from '@/lib/cameras/auth';
import { getHomeAssistantCameraConfig, homeAssistantCameraFetch } from '@/lib/integrations/homeAssistantCameraCredentials';

export const runtime = 'nodejs';

const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function GET(_request: Request, context: { params: Promise<{ cameraId: string }> }) {
  const { cameraId } = await context.params;
  const grant = await getCameraDisplayGrant(cameraId);
  if (!grant) return NextResponse.json({ error: 'Camera display enrollment required' }, { status: 401 });

  const config = await getHomeAssistantCameraConfig();
  const mapping = config?.cameras.find((camera) => camera.enabled && camera.id === cameraId);
  if (!config?.enabled || !mapping) return NextResponse.json({ error: 'Camera is unavailable' }, { status: 404 });

  const snapshotEntityId = mapping.pictureEntityId || mapping.haCameraEntityId;
  const response = await homeAssistantCameraFetch(config, `/api/camera_proxy/${encodeURIComponent(snapshotEntityId)}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok || !response.body) return NextResponse.json({ error: 'Camera snapshot unavailable' }, { status: 502 });
  const [contentType] = (response.headers.get('content-type') || '').split(';', 1);
  const type = (contentType ?? '').toLowerCase();
  if (!ALLOWED_TYPES.has(type)) return NextResponse.json({ error: 'Camera returned an unsupported image' }, { status: 502 });
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_SNAPSHOT_BYTES) return NextResponse.json({ error: 'Camera snapshot is too large' }, { status: 502 });
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SNAPSHOT_BYTES) return NextResponse.json({ error: 'Camera snapshot is invalid' }, { status: 502 });
  const validSignature = (type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8) ||
    (type === 'image/png' && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
    (type === 'image/webp' && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50);
  if (!validSignature) return NextResponse.json({ error: 'Camera snapshot is invalid' }, { status: 502 });
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
