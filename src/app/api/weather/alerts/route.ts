/**
 * NWS weather alerts proxy.
 *
 * GET /api/weather/alerts
 *
 * Returns active NWS alerts for the configured zone filtered to
 * "Actual" / "Alert" messages. Severity filtering (by event name)
 * is done client-side in useNWSAlerts so it can be configured
 * per-dashboard without a server restart.
 *
 * Returns 503 when NWS_ZONE is not configured — the feature is opt-in.
 * Returns 502 when the NWS API itself is unreachable or errors.
 */

import { NextResponse } from 'next/server';
import { getNWSConfig } from '@/lib/config/nws-alerts';
import { logError } from '@/lib/utils/logError';

const NWS_USER_AGENT = 'Prism/1.0 (family dashboard; https://github.com/sandydargoport/prism)';

interface NWSFeature {
  properties: {
    id: string;
    event: string;
    headline?: string;
    description?: string;
    effective: string;
    expires: string;
    status: string;
    messageType: string;
  };
}

export async function GET() {
  const config = getNWSConfig();
  if (!config) {
    return NextResponse.json(
      { error: 'NWS alerts not configured. Set the NWS_ZONE environment variable.' },
      { status: 503 }
    );
  }

  try {
    const url = `https://api.weather.gov/alerts/active?zone=${encodeURIComponent(config.zone)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': NWS_USER_AGENT,
        Accept: 'application/geo+json',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      throw new Error(`NWS API returned ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as { features?: NWSFeature[] };
    const features = data.features ?? [];

    const alerts = features
      .filter(
        (f) =>
          f.properties.status === 'Actual' &&
          f.properties.messageType === 'Alert'
      )
      .map((f) => ({
        id: f.properties.id,
        event: f.properties.event,
        headline: f.properties.headline ?? '',
        description: f.properties.description ?? '',
        effective: f.properties.effective,
        expires: f.properties.expires,
      }));

    return NextResponse.json({ alerts });
  } catch (error) {
    logError('NWS alerts API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weather alerts from NWS.' },
      { status: 502 }
    );
  }
}
