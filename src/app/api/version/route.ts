import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/constants';

// The version endpoint must always reflect the running server rather than a
// statically generated response or a proxy cache.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    { version: APP_VERSION },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}
