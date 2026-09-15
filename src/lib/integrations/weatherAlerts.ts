/**
 * Active weather alerts from the National Weather Service.
 *
 * The NWS point endpoint covers watches, warnings, advisories, and similar
 * products for a latitude/longitude without requiring an API key. Locations
 * outside NWS coverage return an empty list so the weather widget continues to
 * work for the other provider-supported regions.
 */

import type { WeatherAlert, WeatherAlertSeverity } from '@/components/widgets/WeatherWidget';

const NWS_ALERTS_URL = 'https://api.weather.gov/alerts/active';
const NWS_USER_AGENT = 'Prism-Family-Dashboard/1.0 (https://github.com/sandydargoport/prism)';

interface NwsAlertProperties {
  id?: string;
  event?: string;
  headline?: string;
  description?: string;
  instruction?: string;
  severity?: string;
  effective?: string;
  onset?: string;
  expires?: string;
  ends?: string;
  senderName?: string;
  status?: string;
  messageType?: string;
  web?: string;
}

interface NwsAlertFeature {
  id?: string;
  properties?: NwsAlertProperties;
}

interface NwsAlertCollection {
  features?: NwsAlertFeature[];
}

const SEVERITY_ORDER: Record<WeatherAlertSeverity, number> = {
  extreme: 0,
  severe: 1,
  moderate: 2,
  minor: 3,
  unknown: 4,
};

function normalizeSeverity(value?: string): WeatherAlertSeverity {
  switch (value?.trim().toLowerCase()) {
    case 'extreme':
      return 'extreme';
    case 'severe':
      return 'severe';
    case 'moderate':
      return 'moderate';
    case 'minor':
      return 'minor';
    default:
      return 'unknown';
  }
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : undefined;
}

function normalizeAlert(feature: NwsAlertFeature, nowMs: number): WeatherAlert | null {
  const properties = feature.properties;
  if (!properties) return null;

  // `/alerts/active` normally filters these already, but keeping the checks
  // here prevents cancelled or stale records from being rendered if the API
  // returns a transition record.
  if (properties.status && properties.status.toLowerCase() !== 'actual') return null;
  if (
    properties.messageType &&
    !['alert', 'update'].includes(properties.messageType.toLowerCase())
  ) {
    return null;
  }

  const end = parseDate(properties.expires ?? properties.ends);
  if (end && end.getTime() <= nowMs) return null;

  const title = properties.event?.trim() || properties.headline?.trim() || 'Weather alert';
  const headline = properties.headline?.trim();
  const id =
    feature.id || properties.id || `${title}:${properties.effective ?? properties.onset ?? ''}`;

  return {
    id,
    title,
    headline: headline && headline !== title ? headline : undefined,
    description: properties.description?.trim() || undefined,
    instruction: properties.instruction?.trim() || undefined,
    severity: normalizeSeverity(properties.severity),
    source: properties.senderName?.trim() || undefined,
    start: parseDate(properties.effective ?? properties.onset),
    end,
    url: properties.web || feature.id,
  };
}

/**
 * Fetch currently active NWS alerts for a coordinate.
 *
 * Alert availability is deliberately best-effort. NWS only covers the United
 * States and its territories, so a 404, network error, or malformed response
 * becomes an empty list rather than taking down the weather response.
 */
export async function fetchActiveWeatherAlerts(location?: {
  lat: number;
  lon: number;
}): Promise<WeatherAlert[]> {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
    return [];
  }

  const url = new URL(NWS_ALERTS_URL);
  url.searchParams.set('point', `${location.lat},${location.lon}`);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/geo+json',
        'User-Agent': NWS_USER_AGENT,
      },
      next: { revalidate: 300 },
    });
  } catch {
    return [];
  }

  if (!response.ok) return [];

  let data: NwsAlertCollection;
  try {
    data = await response.json();
  } catch {
    return [];
  }

  if (!data || !Array.isArray(data.features)) return [];

  const nowMs = Date.now();
  return (data.features ?? [])
    .map((feature) => normalizeAlert(feature, nowMs))
    .filter((alert): alert is WeatherAlert => alert !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
