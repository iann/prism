import type { AirQuality, WeatherData, WeatherUnits } from '@/components/widgets/WeatherWidget';

const DEFAULT_AIRGRADIENT_URL = 'http://10.0.1.55';
const AIRGRADIENT_TIMEOUT_MS = 2_000;

interface RawAirGradientMeasurement {
  atmp?: unknown;
  atmpCompensated?: unknown;
  rhum?: unknown;
  rhumCompensated?: unknown;
  pm02?: unknown;
  pm10?: unknown;
  rco2?: unknown;
  tvocIndex?: unknown;
  noxIndex?: unknown;
}

export interface AirGradientMeasurement {
  temperatureC: number;
  humidity?: number;
  airQuality?: AirQuality;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validTemperatureC(value: unknown): value is number {
  return finiteNumber(value) && value >= -80 && value <= 80;
}

function validHumidity(value: unknown): value is number {
  return finiteNumber(value) && value >= 0 && value <= 100;
}

function firstValid<T>(...values: Array<T | undefined>): T | undefined {
  return values.find((value): value is T => value !== undefined);
}

function getAirGradientUrl(): string {
  return (process.env.AIRGRADIENT_URL || DEFAULT_AIRGRADIENT_URL).replace(/\/+$/, '');
}

/** Fetch the latest local AirGradient reading from the monitor's LAN API. */
export async function fetchAirGradientMeasurement(): Promise<AirGradientMeasurement> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AIRGRADIENT_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(`${getAirGradientUrl()}/measures/current`, {
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`AirGradient network error: ${message}`);
    }

    if (!response.ok) {
      throw new Error(`AirGradient returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as RawAirGradientMeasurement;
    const temperatureC = firstValid(
      validTemperatureC(data.atmp) ? data.atmp : undefined,
      validTemperatureC(data.atmpCompensated) ? data.atmpCompensated : undefined
    );

    if (temperatureC === undefined) {
      throw new Error('AirGradient response did not include a valid temperature');
    }

    const humidity = firstValid(
      validHumidity(data.rhum) ? data.rhum : undefined,
      validHumidity(data.rhumCompensated) ? data.rhumCompensated : undefined
    );

    const airQuality: AirQuality = {};
    if (finiteNumber(data.pm02)) airQuality.pm25 = Math.round(data.pm02 * 10) / 10;
    if (finiteNumber(data.pm10)) airQuality.pm10 = Math.round(data.pm10 * 10) / 10;
    if (finiteNumber(data.rco2)) airQuality.co2 = Math.round(data.rco2);
    if (finiteNumber(data.tvocIndex)) airQuality.tvocIndex = Math.round(data.tvocIndex);
    if (finiteNumber(data.noxIndex)) airQuality.noxIndex = Math.round(data.noxIndex);

    return {
      temperatureC,
      humidity,
      airQuality: Object.keys(airQuality).length > 0 ? airQuality : undefined,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Approximate the NWS apparent temperature using the local sensor's readings.
 * The monitor does not measure wind, so the provider's wind speed is retained.
 */
export function calculateFeelsLikeF(
  temperatureF: number,
  humidity: number,
  windSpeedMph: number
): number {
  if (temperatureF >= 80) {
    let heatIndex =
      -42.379 +
      2.04901523 * temperatureF +
      10.14333127 * humidity -
      0.22475541 * temperatureF * humidity -
      0.00683783 * temperatureF * temperatureF -
      0.05481717 * humidity * humidity +
      0.00122874 * temperatureF * temperatureF * humidity +
      0.00085282 * temperatureF * humidity * humidity -
      0.00000199 * temperatureF * temperatureF * humidity * humidity;

    if (humidity < 13 && temperatureF <= 112) {
      heatIndex -= ((13 - humidity) / 4) * Math.sqrt((17 - Math.abs(temperatureF - 95)) / 17);
    } else if (humidity > 85 && temperatureF <= 87) {
      heatIndex += ((humidity - 85) / 10) * ((87 - temperatureF) / 5);
    }

    return Math.round(heatIndex);
  }

  if (temperatureF <= 50 && windSpeedMph > 3) {
    const windPower = windSpeedMph ** 0.16;
    return Math.round(
      35.74 + 0.6215 * temperatureF - 35.75 * windPower + 0.4275 * temperatureF * windPower
    );
  }

  return Math.round(temperatureF);
}

function celsiusToDisplay(celsius: number, units: WeatherUnits): number {
  return Math.round(units.temperature === 'C' ? celsius : (celsius * 9) / 5 + 32);
}

function hourlyTimeMs(time: Date | string): number {
  return time instanceof Date ? time.getTime() : new Date(time).getTime();
}

/** Keep the timeline's active hour aligned with the current display reading. */
export function syncCurrentHourlyTemperature(weatherData: WeatherData): WeatherData {
  if (!weatherData.hourly || weatherData.hourly.length === 0) return weatherData;

  const nowMs = Date.now();
  const activeHourlyIndex = weatherData.hourly.findIndex((hour) => {
    const hourMs = hourlyTimeMs(hour.time);
    return hourMs <= nowMs && hourMs + 60 * 60_000 > nowMs;
  });
  const timelineHourlyIndex = activeHourlyIndex >= 0
    ? activeHourlyIndex
    : weatherData.hourly.findIndex((hour) => hourlyTimeMs(hour.time) > nowMs);

  if (timelineHourlyIndex < 0) return weatherData;

  return {
    ...weatherData,
    hourly: weatherData.hourly.map((hour, index) =>
      index === timelineHourlyIndex
        ? { ...hour, temp: weatherData.current.temperature }
        : hour
    ),
  };
}

/** Overlay local temperature, humidity, air quality, and derived feels-like data. */
export function applyAirGradientCurrent(
  weatherData: WeatherData,
  measurement: AirGradientMeasurement,
  units: WeatherUnits
): WeatherData {
  const temperature = celsiusToDisplay(measurement.temperatureC, units);
  const humidity = measurement.humidity ?? weatherData.current.humidity;
  const temperatureF = (measurement.temperatureC * 9) / 5 + 32;
  const windSpeedMph =
    units.windSpeed === 'km/h'
      ? weatherData.current.windSpeed * 0.621371
      : weatherData.current.windSpeed;
  const feelsLikeF =
    measurement.humidity === undefined
      ? weatherData.current.feelsLike
      : calculateFeelsLikeF(temperatureF, humidity, windSpeedMph);
  const feelsLike =
    measurement.humidity === undefined
      ? feelsLikeF
      : units.temperature === 'C'
        ? Math.round(((feelsLikeF - 32) * 5) / 9)
        : feelsLikeF;

  return syncCurrentHourlyTemperature({
    ...weatherData,
    lastUpdated: new Date(),
    current: {
      ...weatherData.current,
      temperature,
      feelsLike,
      humidity: Math.round(humidity),
      airQuality: measurement.airQuality,
    },
  });
}
