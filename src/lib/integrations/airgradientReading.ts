import { getCache, setCache } from '@/lib/cache/redis';
import {
  fetchAirGradientMeasurement,
  type AirGradientMeasurement,
} from './airgradient';

/**
 * How often the monitor's LAN API is actually polled. Requests inside this
 * window are served from the snapshot instead of hitting the sensor.
 */
export const AIRGRADIENT_POLL_INTERVAL_MS = 5 * 60_000;

/**
 * How long a failed poll may keep serving the last good reading. Only after
 * this window has passed is the monitor treated as offline and the weather
 * provider's current data used instead.
 */
export const AIRGRADIENT_OFFLINE_AFTER_MS = 15 * 60_000;

const SNAPSHOT_TTL_SECONDS = 24 * 60 * 60;

type AirGradientSnapshot = {
  measurement: AirGradientMeasurement | null;
  /** When `measurement` was fetched. */
  fetchedAt: number | null;
  /** When the monitor was last polled, successfully or not. */
  checkedAt: number;
  /** First failed poll of the current outage; cleared by a successful poll. */
  failedSince: number | null;
  /** Whether the current outage has already been reported to the caller. */
  offlineReported: boolean;
};

export type AirGradientReading =
  | {
      status: 'fresh' | 'stale';
      measurement: AirGradientMeasurement;
      /** When the reading was taken, used to report the real data age. */
      observedAt: Date;
    }
  | {
      status: 'offline';
      /** Present only on the poll that discovered the outage. */
      error?: unknown;
    };

function snapshotKey(): string {
  const target = process.env.AIRGRADIENT_URL?.trim() || 'default';
  return `airgradient:${target}:snapshot`;
}

function readingFromSnapshot(snapshot: AirGradientSnapshot, nowMs: number): AirGradientReading {
  if (snapshot.measurement !== null && snapshot.fetchedAt !== null) {
    const outageMs = snapshot.failedSince === null ? 0 : nowMs - snapshot.failedSince;
    if (outageMs <= AIRGRADIENT_OFFLINE_AFTER_MS) {
      const ageMs = nowMs - snapshot.fetchedAt;
      return {
        status: outageMs === 0 && ageMs < AIRGRADIENT_POLL_INTERVAL_MS ? 'fresh' : 'stale',
        measurement: snapshot.measurement,
        observedAt: new Date(snapshot.fetchedAt),
      };
    }
  }

  return { status: 'offline' };
}

/**
 * Read the local AirGradient monitor with a small poll budget and an offline
 * grace window.
 *
 * - A reading fetched in the last five minutes is reused without a request.
 * - A failed poll keeps returning the last good reading for up to fifteen
 *   minutes of consecutive failures, so a brief Wi-Fi hiccup does not drop the
 *   widget to provider data (and `observedAt` keeps the displayed age honest).
 * - Only after that does it report `offline`, letting the caller fall back and
 *   surface the monitor as down.
 */
export async function readAirGradient(
  fetchMeasurement: () => Promise<AirGradientMeasurement> = fetchAirGradientMeasurement,
  now: () => number = Date.now,
): Promise<AirGradientReading> {
  const key = snapshotKey();
  const nowMs = now();
  const snapshot = await getCache<AirGradientSnapshot>(key);

  if (snapshot && nowMs - snapshot.checkedAt < AIRGRADIENT_POLL_INTERVAL_MS) {
    return readingFromSnapshot(snapshot, nowMs);
  }

  try {
    const measurement = await fetchMeasurement();
    const fetchedAt = now();
    await setCache<AirGradientSnapshot>(
      key,
      { measurement, fetchedAt, checkedAt: fetchedAt, failedSince: null, offlineReported: false },
      SNAPSHOT_TTL_SECONDS,
    );
    return { status: 'fresh', measurement, observedAt: new Date(fetchedAt) };
  } catch (error) {
    // Remember the attempt so a dashboard polling every minute does not retry
    // the monitor every minute while it is offline. The outage is dated from
    // the first poll that would have followed the last good reading, so a
    // snapshot left behind overnight counts as offline immediately.
    const failedAt = now();
    const firstMissedPoll = snapshot?.fetchedAt !== null && snapshot?.fetchedAt !== undefined
      ? Math.min(failedAt, snapshot.fetchedAt + AIRGRADIENT_POLL_INTERVAL_MS)
      : failedAt;
    const failedSnapshot: AirGradientSnapshot = {
      measurement: snapshot?.measurement ?? null,
      fetchedAt: snapshot?.fetchedAt ?? null,
      checkedAt: failedAt,
      failedSince: snapshot?.failedSince ?? firstMissedPoll,
      offlineReported: snapshot?.offlineReported ?? false,
    };

    const reading = readingFromSnapshot(failedSnapshot, failedAt);
    if (reading.status !== 'offline') {
      await setCache<AirGradientSnapshot>(key, failedSnapshot, SNAPSHOT_TTL_SECONDS);
      return reading;
    }

    // Report the outage on the poll that discovers it, not on every retry
    // afterwards.
    const shouldReport = !failedSnapshot.offlineReported;
    await setCache<AirGradientSnapshot>(
      key,
      { ...failedSnapshot, offlineReported: true },
      SNAPSHOT_TTL_SECONDS,
    );
    return shouldReport ? { status: 'offline', error } : { status: 'offline' };
  }
}
