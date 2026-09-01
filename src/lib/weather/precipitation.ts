import type {
  HourlyForecast,
  MinutelyData,
  WeatherCondition,
  WeatherData,
  WeatherUnits,
} from '@/components/widgets/WeatherWidget';

export const PRECIPITATION_LOOKBACK_MS = 2 * 60 * 60 * 1000;
export const PRECIPITATION_LOOKAHEAD_MS = 2 * 60 * 60 * 1000;

const MILLIMETERS_PER_INCH = 25.4;
const MEANINGFUL_PRECIPITATION_MM = 0.1;
const EXPECTED_PRECIPITATION_PROBABILITY = 50;

/** Weather condition categories that represent precipitation rather than just cloud cover. */
export function isPrecipitatingCondition(condition: WeatherCondition | undefined): boolean {
  return condition === 'rainy' || condition === 'snowy' || condition === 'stormy';
}

function toMilliseconds(value: Date | string | number): number {
  const date = value instanceof Date ? value : new Date(value);
  return date.getTime();
}

function hasMeaningfulPrecipitation(value: number | undefined, units: WeatherUnits): boolean {
  if (value === undefined || !Number.isFinite(value)) return false;
  const millimeters = units.precipitation === 'in' ? value * MILLIMETERS_PER_INCH : value;
  return millimeters >= MEANINGFUL_PRECIPITATION_MM;
}

function isInWindow(timeMs: number, nowMs: number): boolean {
  return (
    Number.isFinite(timeMs) &&
    timeMs >= nowMs - PRECIPITATION_LOOKBACK_MS &&
    timeMs <= nowMs + PRECIPITATION_LOOKAHEAD_MS
  );
}

function hourlySignalsPrecipitation(hour: HourlyForecast, nowMs: number, units: WeatherUnits) {
  const timeMs = toMilliseconds(hour.time);
  if (!isInWindow(timeMs, nowMs)) return false;

  if (isPrecipitatingCondition(hour.condition)) return true;
  if (hasMeaningfulPrecipitation(hour.precipIntensity, units)) return true;

  // A future forecast can legitimately report a non-zero chance before its
  // precipitation amount is populated. Do not use probability alone for past
  // hours, where it would confuse a forecast with observed precipitation.
  return timeMs > nowMs && (hour.precipProbability ?? 0) >= EXPECTED_PRECIPITATION_PROBABILITY;
}

function minutelySignalsPrecipitation(minute: MinutelyData, nowMs: number, units: WeatherUnits) {
  const timeMs = minute.time * 1000;
  if (!isInWindow(timeMs, nowMs)) return false;
  if (hasMeaningfulPrecipitation(minute.precipIntensity, units)) return true;

  return timeMs > nowMs && minute.precipProbability >= 0.5;
}

/**
 * Whether the dashboard should surface the Windy map for the current weather
 * window: active precipitation, precipitation during the previous two hours,
 * or precipitation expected during the next two hours.
 */
export function hasPrecipitationInRadarWindow(
  weather: Pick<WeatherData, 'current' | 'hourly' | 'minutely' | 'units'>,
  nowMs = Date.now()
): boolean {
  if (isPrecipitatingCondition(weather.current.condition)) return true;

  if (weather.hourly?.some((hour) => hourlySignalsPrecipitation(hour, nowMs, weather.units))) {
    return true;
  }

  return Boolean(
    weather.minutely?.some((minute) => minutelySignalsPrecipitation(minute, nowMs, weather.units))
  );
}
