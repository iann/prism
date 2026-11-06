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

const NWS_POINTS_URL = 'https://api.weather.gov/points';
const NWS_USER_AGENT = 'Prism-Family-Dashboard/1.0 (https://github.com/sandydargoport/prism)';
const OUTLOOK_DAY_LIMIT = 3;
const POINT_CACHE_SECONDS = 24 * 60 * 60;
const FORECAST_CACHE_SECONDS = 30 * 60;

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
 * Fetch the next three daytime forecasts for a coordinate.
 *
 * Periods alternate day and night, so only daytime entries are kept — the
 * widget readout is a daily outlook, not a day/night pair. NWS labels the
 * current day "Today" and later days by name, which is exactly the label the
 * readout wants.
 */
export async function fetchWeatherOutlook(location?: {
  lat: number;
  lon: number;
}): Promise<WeatherOutlookDay[]> {
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

  return periods
    .filter((period) => period.isDaytime !== false)
    .map((period) => {
      const short = cleanText(period.shortForecast);
      const detail = firstSentence(cleanText(period.detailedForecast));
      return {
        day: cleanText(period.name),
        start: period.startTime ?? '',
        short,
        detail,
      };
    })
    .filter((period) => period.short.length > 0 || period.detail.length > 0)
    .slice(0, OUTLOOK_DAY_LIMIT);
}
