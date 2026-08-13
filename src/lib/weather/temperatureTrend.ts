/**
 * Estimate the short-term direction of the provider's temperature forecast.
 *
 * Weather providers already return a smoothed forecast time series, so a
 * simple first difference is more appropriate here than comparing the next
 * forecast value with the current sensor reading. The active timeline point
 * may be replaced by an AirGradient observation, so only future provider
 * points are used. We deliberately compare rounded values: the trend label
 * should only appear when the temperature would visibly change in the widget.
 */

export type TemperatureTrend = 'rising' | 'falling' | null;

export interface TemperatureTrendPoint {
  time: Date | string | number;
  temp: number;
}

/**
 * Look far enough ahead to include two samples from three-hour providers
 * while keeping the label about the near-term forecast.
 */
export const TEMPERATURE_TREND_WINDOW_MS = 6 * 60 * 60 * 1000;

function toTimeMs(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

/**
 * Return the direction between the next two usable forecast points. A null
 * result means the forecast is steady at its display precision, or that there
 * are not two sufficiently near forecast points.
 */
export function getTemperatureTrend(
  forecast: readonly TemperatureTrendPoint[] | undefined,
  nowMs = Date.now()
): TemperatureTrend {
  if (!Number.isFinite(nowMs)) return null;

  const nextPoints = (forecast ?? [])
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
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, 2);

  const [firstPoint, secondPoint] = nextPoints;
  if (!firstPoint || !secondPoint) return null;

  const firstDisplayTemperature = Math.round(firstPoint.temp);
  const secondDisplayTemperature = Math.round(secondPoint.temp);

  if (secondDisplayTemperature === firstDisplayTemperature) return null;
  return secondDisplayTemperature > firstDisplayTemperature ? 'rising' : 'falling';
}
