/**
 * Configuration for NWS severe weather alerts.
 *
 * All values are read at call time from environment variables so that
 * tests can manipulate process.env without worrying about module caching.
 *
 * Required:
 *   NWS_ZONE — e.g. "MAZ015" (Metro Boston). If absent, getNWSConfig()
 *   returns null and the feature is dormant.
 *
 * Optional:
 *   NWS_RADAR_LAT / NWS_RADAR_LON — center for the radar map (default 38.9 / -77.0)
 *   NWS_POLL_INTERVAL_MS           — client poll interval in ms (default 120000)
 *   NWS_SEVERITY_FILTER            — comma-separated list of NWS event names to treat
 *                                    as severe (default: the four standard warning/watch types)
 */

export const DEFAULT_SEVERITY_FILTER: readonly string[] = [
  'Severe Thunderstorm Warning',
  'Tornado Warning',
  'Tornado Watch',
  'Severe Thunderstorm Watch',
];

export interface NWSConfig {
  zone: string;
  radarCenter: [number, number];
  pollIntervalMs: number;
  severityFilter: string[];
}

/**
 * Returns the NWS alerts configuration, or null if NWS_ZONE is not set.
 * A null return value means the feature is not configured and should be dormant.
 */
export function getNWSConfig(): NWSConfig | null {
  const zone = process.env.NWS_ZONE;
  if (!zone) return null;

  const lat = Number(process.env.NWS_RADAR_LAT ?? '38.9');
  const lon = Number(process.env.NWS_RADAR_LON ?? '-77.0');

  const pollIntervalMs = Number(process.env.NWS_POLL_INTERVAL_MS ?? '120000');

  const severityFilter = process.env.NWS_SEVERITY_FILTER
    ? process.env.NWS_SEVERITY_FILTER.split(',').map((s) => s.trim()).filter(Boolean)
    : [...DEFAULT_SEVERITY_FILTER];

  return { zone, radarCenter: [lat, lon], pollIntervalMs, severityFilter };
}
