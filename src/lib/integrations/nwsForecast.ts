/**
 * Human-written forecast text from the National Weather Service.
 *
 * NWS publishes its narrative forecast as structured GeoJSON, so the widget
 * can show the same wording as forecast.weather.gov without scraping HTML.
 * The service covers the United States and its territories only; a location
 * outside that area, or an NWS outage, returns an empty list so the widget
 * falls back to its generated summary.
 *
 * The forecast endpoint is reached through the point lookup, which maps a
 * coordinate to a forecast office grid. The grid mapping is stable, so it is
 * cached for a day; the narrative itself refreshes more often.
 */

import type { WeatherOutlookDay } from '@/components/widgets/WeatherWidget';
import { wallTimeAt } from '@/lib/utils/zonedDate';

const NWS_POINTS_URL = 'https://api.weather.gov/points';
const NWS_USER_AGENT = 'Prism-Family-Dashboard/1.0 (https://github.com/sandydargoport/prism)';
const OUTLOOK_DAY_LIMIT = 3;
const POINT_CACHE_SECONDS = 24 * 60 * 60;
const FORECAST_CACHE_SECONDS = 30 * 60;

/**
 * The evening outlook window, in the household's local time.
 *
 * During this window the current night period ("Tonight") leads the outlook;
 * after 22:00 the readout rolls over to the next daytime period so a late-night
 * glance shows tomorrow rather than the tail of today.
 */
const EVENING_WINDOW_START_HOUR = 16;
const EVENING_WINDOW_END_HOUR = 22;

type NwsPointProperties = {
  forecast?: string;
};

type NwsForecastPeriod = {
  name?: string;
  startTime?: string;
  isDaytime?: boolean;
  shortForecast?: string;
  detailedForecast?: string;
};

type NwsForecastProperties = {
  periods?: NwsForecastPeriod[];
};

async function fetchNwsJson<T>(url: string, revalidate: number): Promise<T | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/geo+json',
        'User-Agent': NWS_USER_AGENT,
      },
      next: { revalidate },
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function cleanText(value?: string): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

/** Keep the headline sentence; the rest of the narrative is usually details. */
function firstSentence(value: string): string {
  const match = value.match(/^.*?[.!?](?:\s|$)/);
  return (match?.[0] ?? value).trim();
}

/**
 * Whether the current evening forecast should lead the outlook.
 *
 * Expressed as an hour window in the household's zone so the rollover happens
 * at a predictable wall-clock time rather than whenever NWS happens to refresh
 * its periods.
 */
export function isEveningOutlookWindow(now: Date, timeZone: string): boolean {
  const hour = Number(wallTimeAt(timeZone, now).slice(0, 2));
  return (
    Number.isFinite(hour) &&
    hour >= EVENING_WINDOW_START_HOUR &&
    hour < EVENING_WINDOW_END_HOUR
  );
}

/**
 * Fetch the next three forecasts for a coordinate.
 *
 * Periods alternate day and night. Normally only daytime entries are kept, so
 * the widget shows a daily outlook. During the evening window the current
 * night period ("Tonight") is more useful than tomorrow's daytime summary, so
 * it is kept when NWS has already promoted it to the first period. At 22:00
 * the evening window closes and the outlook rolls over to the next day.
 */
export async function fetchWeatherOutlook(
  location?: {
    lat: number;
    lon: number;
  },
  options?: { now?: Date; timeZone?: string },
): Promise<WeatherOutlookDay[]> {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
    return [];
  }

  const point = await fetchNwsJson<{ properties?: NwsPointProperties }>(
    `${NWS_POINTS_URL}/${location.lat.toFixed(4)},${location.lon.toFixed(4)}`,
    POINT_CACHE_SECONDS,
  );
  const forecastUrl = point?.properties?.forecast;
  if (!forecastUrl) return [];

  const forecast = await fetchNwsJson<{ properties?: NwsForecastProperties }>(
    forecastUrl,
    FORECAST_CACHE_SECONDS,
  );
  const periods = forecast?.properties?.periods;
  if (!Array.isArray(periods)) return [];

  const timeZone =
    options?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const now = options?.now ?? new Date();
  const leadWithTonight =
    isEveningOutlookWindow(now, timeZone) &&
    periods.length > 0 &&
    periods[0]?.isDaytime === false &&
    /^tonight$/i.test(cleanText(periods[0]?.name));

  return periods
    .filter(
      (period, index) =>
        period.isDaytime !== false || (index === 0 && leadWithTonight),
    )
    .map((period) => {
      const detailedForecast = cleanText(period.detailedForecast);
      const short = cleanText(period.shortForecast);
      const detail = firstSentence(detailedForecast);
      return {
        day: cleanText(period.name),
        start: period.startTime ?? '',
        short,
        detail,
        detailedForecast,
      };
    })
    .filter((period) => period.short.length > 0 || period.detail.length > 0)
    .slice(0, OUTLOOK_DAY_LIMIT);
}
