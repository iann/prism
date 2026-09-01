import { NextRequest, NextResponse } from 'next/server';
import { rewriteWindyEmbedHtml } from '@/lib/weather/windyProxy';

const WINDY_EMBED_URL = 'https://embed.windy.com/embed2.html';
const WINDY_QUERY_KEYS = [
  'type',
  'location',
  'metricRain',
  'metricTemp',
  'metricWind',
  'zoom',
  'overlay',
  'product',
  'level',
  'play',
  'menu',
  'calendar',
  'lat',
  'lon',
  'marker',
  'message',
] as const;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildUpstreamUrl(request: NextRequest): URL {
  const upstream = new URL(WINDY_EMBED_URL);

  for (const key of WINDY_QUERY_KEYS) {
    const value = request.nextUrl.searchParams.get(key);
    if (value !== null) upstream.searchParams.set(key, value);
  }

  return upstream;
}

export async function GET(request: NextRequest) {
  try {
    const upstreamResponse = await fetch(buildUpstreamUrl(request), {
      cache: 'no-store',
      headers: {
        Accept: 'text/html',
        'User-Agent': request.headers.get('user-agent') ?? 'Prism-Family-Dashboard/1.0',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstreamResponse.ok) {
      return new NextResponse('Windy embed unavailable', {
        status: upstreamResponse.status,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const html = rewriteWindyEmbedHtml(await upstreamResponse.text());
    return new NextResponse(html, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('[windy-proxy] embed fetch failed:', error);
    return new NextResponse('Windy embed unavailable', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
