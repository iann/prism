/**
 * Estimate the short-term direction of the displayed temperature.
 *
 * Weather providers already return a smoothed forecast time series, so a
 * simple first difference is more appropriate here than trying to predict
 * from the current sensor reading. We deliberately compare rounded values:
 * the trend label should only appear when the temperature would visibly
 * change in the widget.
 */

export type TemperatureTrend = 'rising' | 'falling' | null;

export interface TemperatureTrendPoint {
  time: Date | string | number;
  temp: number;
}

/** A little longer than one hour to cover hourly samples around the boundary. */
export const TEMPERATURE_TREND_WINDOW_MS = 90 * 60 * 1000;

function toTimeMs(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

/**
 * Return the direction of the nearest usable forecast point in the next hour
 * or so. A null result means the displayed temperature is steady at its
 * precision, or that there is no sufficiently near forecast point.
 */
export function getTemperatureTrend(
  currentTemperature: number,
  forecast: readonly TemperatureTrendPoint[] | undefined,
  nowMs = Date.now()
): TemperatureTrend {
  if (!Number.isFinite(currentTemperature) || !Number.isFinite(nowMs)) return null;

  const nextPoint = (forecast ?? [])
    .map((point) => ({
      timeMs: toTimeMs(point.time),
      temp: point.temp,
    }))
    .filter(
      ({ timeMs, temp }) =>
        Number.isFinite(timeMs) &&
        Number.isFinite(temp) &&
        timeMs > nowMs &&
        timeMs <= nowMs + TEMPERATURE_TREND_WINDOW_MS
    )
    .sort((a, b) => a.timeMs - b.timeMs)[0];

  if (!nextPoint) return null;

  const currentDisplayTemperature = Math.round(currentTemperature);
  const forecastDisplayTemperature = Math.round(nextPoint.temp);

  if (forecastDisplayTemperature === currentDisplayTemperature) return null;
  return forecastDisplayTemperature > currentDisplayTemperature ? 'rising' : 'falling';
}
