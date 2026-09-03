import { getDisplayAuth } from '@/lib/auth';
import {
  getHomeAssistantConfig,
  homeAssistantFetch,
} from '@/lib/integrations/homeAssistantCredentials';
export async function GET() {
  if (!(await getDisplayAuth())) return new Response(null, { status: 401 });
  const config = await getHomeAssistantConfig();
  if (!config) return new Response(null, { status: 404 });
  try {
    const stateResponse = await homeAssistantFetch(
      config,
      `/api/states/${encodeURIComponent(config.mediaPlayerEntityId)}`
    );
    if (!stateResponse.ok) return new Response(null, { status: 404 });
    const picture = (await stateResponse.json())?.attributes?.entity_picture;
    if (typeof picture !== 'string' || !picture) return new Response(null, { status: 404 });
    const base = new URL(config.baseUrl);
    const url = new URL(picture, base);
    if (url.origin !== base.origin) return new Response(null, { status: 404 });
    const image = await homeAssistantFetch(config, `${url.pathname}${url.search}`, {
      headers: { Accept: 'image/*' },
    });
    if (!image.ok || !image.body) return new Response(null, { status: 404 });
    return new Response(image.body, {
      headers: {
        'Content-Type': image.headers.get('content-type')?.startsWith('image/')
          ? image.headers.get('content-type')!
          : 'application/octet-stream',
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
