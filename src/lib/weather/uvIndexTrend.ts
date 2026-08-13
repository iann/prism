/** Estimate the short-term direction of the displayed UV index. */

export type UvIndexTrend = 'rising' | 'falling' | null;

export interface UvIndexTrendPoint {
  time: Date | string | number;
  uvIndex?: number;
}

/** A little longer than one hour to cover hourly samples around the boundary. */
export const UV_INDEX_TREND_WINDOW_MS = 90 * 60 * 1000;

function toTimeMs(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

function displayedUvIndex(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Return the direction of the nearest usable forecast point in the next hour
 * or so. A null result means the displayed UV index is steady or unavailable.
 */
export function getUvIndexTrend(
  currentUvIndex: number,
  forecast: readonly UvIndexTrendPoint[] | undefined,
  nowMs = Date.now()
): UvIndexTrend {
  if (!Number.isFinite(currentUvIndex) || currentUvIndex < 0 || !Number.isFinite(nowMs)) {
    return null;
  }

  const nextPoint = (forecast ?? [])
    .map((point) => ({
      timeMs: toTimeMs(point.time),
      uvIndex: point.uvIndex,
    }))
    .filter(
      (point): point is { timeMs: number; uvIndex: number } =>
        Number.isFinite(point.timeMs) &&
        point.uvIndex !== undefined &&
        Number.isFinite(point.uvIndex) &&
        point.uvIndex >= 0 &&
        point.timeMs > nowMs &&
        point.timeMs <= nowMs + UV_INDEX_TREND_WINDOW_MS
    )
    .sort((a, b) => a.timeMs - b.timeMs)[0];

  if (!nextPoint) return null;

  const currentDisplayedUvIndex = displayedUvIndex(currentUvIndex);
  const forecastDisplayedUvIndex = displayedUvIndex(nextPoint.uvIndex);

  if (forecastDisplayedUvIndex === currentDisplayedUvIndex) return null;
  return forecastDisplayedUvIndex > currentDisplayedUvIndex ? 'rising' : 'falling';
}
