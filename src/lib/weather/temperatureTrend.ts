/**
 * Estimate the short-term direction of the provider's temperature forecast.
 *
 * Weather providers already return a smoothed forecast time series, so a
 * simple first difference is more appropriate here than comparing the next
 * forecast value with the current sensor reading. The active timeline point
 * may be replaced by an AirGradient observation, so only future provider
 * points are used. The label is shown only when both actual and feels-like
 * temperatures move in the same direction. We deliberately compare rounded
 * values: the trend label should only appear when the temperature would
 * visibly change in the widget.
 */

export type TemperatureTrend = 'rising' | 'falling' | null;

export interface TemperatureTrendPoint {
  time: Date | string | number;
  temp: number;
  feelsLike: number;
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

function getDirection(first: number, second: number): TemperatureTrend {
  const firstDisplayTemperature = Math.round(first);
  const secondDisplayTemperature = Math.round(second);

  if (secondDisplayTemperature === firstDisplayTemperature) return null;
  return secondDisplayTemperature > firstDisplayTemperature ? 'rising' : 'falling';
}

/**
 * Return the direction shared by actual and feels-like temperatures between
 * the next two usable forecast points. A null result means either series is
 * steady, the series disagree, or there are not two sufficiently near points.
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
      feelsLike: point.feelsLike,
    }))
    .filter(
      ({ timeMs, temp, feelsLike }) =>
        Number.isFinite(timeMs) &&
        Number.isFinite(temp) &&
        Number.isFinite(feelsLike) &&
        timeMs > nowMs &&
        timeMs <= nowMs + TEMPERATURE_TREND_WINDOW_MS
    )
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, 2);

  const [firstPoint, secondPoint] = nextPoints;
  if (!firstPoint || !secondPoint) return null;

  const temperatureDirection = getDirection(firstPoint.temp, secondPoint.temp);
  const feelsLikeDirection = getDirection(firstPoint.feelsLike, secondPoint.feelsLike);

  if (!temperatureDirection || temperatureDirection !== feelsLikeDirection) return null;
  return temperatureDirection;
}
