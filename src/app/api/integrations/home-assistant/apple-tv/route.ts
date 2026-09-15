import { NextResponse } from 'next/server';
import { GET as getMediaPlayer } from '../media-player/route';

/** Compatibility route for clients that still use the pre-rename Apple TV URL. */
export async function GET() {
  const response = await getMediaPlayer();
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return response;

  const body = await response.json();
  if (typeof body?.artworkUrl === 'string') {
    body.artworkUrl = body.artworkUrl.replace(
      '/api/integrations/home-assistant/media-player/artwork',
      '/api/integrations/home-assistant/apple-tv/artwork'
    );
  }
  return NextResponse.json(body, { status: response.status });
}
