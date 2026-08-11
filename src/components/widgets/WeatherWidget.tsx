/**
 *
 * Displays current weather conditions, a multi-day forecast summary,
 * and an 8-hour hourly forecast (one card per hour with icon, temp, and
 * chance-of-precipitation).
 *
 * FEATURES:
 * - Current temperature and conditions
 * - "Feels like" temperature, humidity, wind
 * - Multi-day forecast summary (day name, hi/lo, icon)
 * - Hourly forecast cards (Apple/Google-Weather style)
 * - Configurable number of days in the summary (forecastDays prop)
 * - Celsius/Fahrenheit toggle
 * - Responsive layout
 *
 * DATA SOURCE:
 * Uses OpenWeatherMap API (configured in .env).
 * Falls back to demo data when no external data is provided.
 *
 * USAGE:
 *   <WeatherWidget />
 *   <WeatherWidget location="Chicago, IL" forecastDays={7} />
 *
 */

'use client';

import * as React from 'react';
import SunCalc from 'suncalc';
import {
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  CloudSun,
  Sunrise,
  Sunset,
  Wind,
  Droplets,
  Zap,
  Thermometer,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DAYS_SHORT_ARRAY } from '@/lib/constants/days';
import { getTemperatureTrend } from '@/lib/weather/temperatureTrend';
import { WidgetContainer } from './WidgetContainer';
import { DayHeader } from './WeatherForecastBar';

const SUN_PATH_SAMPLES = 48;
const MIDNIGHT_ROLLOVER_BUFFER_MS = 50;
const MILLIMETERS_PER_INCH = 25.4;
// Use the NWS heavy-rain boundary as the visual ceiling, then apply a
// square-root curve so light and moderate rain remain legible without making
// a strong shower look maxed out too early.
const PRECIPITATION_FULL_SCALE_MM_PER_HOUR = 7.62;
const PRECIPITATION_VARIATION_FRACTION = 0.05;
const PRECIPITATION_WAVE_UNDULATION_PX = 4;
const PRECIPITATION_WAVE_PRIMARY_FREQUENCY = 0.36;
const PRECIPITATION_WAVE_SECONDARY_FREQUENCY = 0.14;
const RAIN_THRESHOLD_MM_PER_HOUR = 0.1;

function localDayStartMs(nowMs = Date.now()): number {
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

function nextLocalDayStartMs(dayStartMs: number): number {
  const next = new Date(dayStartMs);
  next.setDate(next.getDate() + 1);
  return next.getTime();
}

function useLocalDayStartMs(): number {
  const [dayStartMs, setDayStartMs] = React.useState(localDayStartMs);

  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleRollover = () => {
      const nowMs = Date.now();
      const nextDayStartMs = nextLocalDayStartMs(localDayStartMs(nowMs));
      timeoutId = setTimeout(() => {
        setDayStartMs(localDayStartMs());
        scheduleRollover();
      }, nextDayStartMs - nowMs + MIDNIGHT_ROLLOVER_BUFFER_MS);
    };

    scheduleRollover();
    return () => clearTimeout(timeoutId);
  }, []);

  return dayStartMs;
}

/**
 * WEATHER DATA TYPES
 */

export type WeatherCondition =
  | 'sunny'
  | 'partly-cloudy'
  | 'cloudy'
  | 'rainy'
  | 'snowy'
  | 'stormy';

export interface AirQuality {
  pm25?: number;
  pm10?: number;
  co2?: number;
  tvocIndex?: number;
  noxIndex?: number;
}

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  condition: WeatherCondition;
  humidity: number;
  windSpeed: number;
  /** Optional gust speed in the same units as windSpeed. */
  windGust?: number;
  /** Optional UV index for the current hour. */
  uvIndex?: number;
  /** Optional dew point in the configured temperature units. */
  dewPoint?: number;
  /** Optional visibility in miles (imperial) or kilometers (metric). */
  visibility?: number;
  description: string;
  airQuality?: AirQuality;
}

export type WeatherCurrentSource = 'airgradient' | 'pirate' | 'provider';

export type WeatherAlertSeverity = 'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown';

export interface WeatherAlert {
  id: string;
  /** Short event name, such as "Heat Advisory" or "Tornado Warning". */
  title: string;
  /** Issuer-provided headline, when it adds context beyond the event name. */
  headline?: string;
  description?: string;
  instruction?: string;
  severity: WeatherAlertSeverity;
  source?: string;
  start?: Date;
  end?: Date;
  url?: string;
}

export interface ForecastDay {
  date: Date;
  dayName: string;
  high: number;
  low: number;
  condition: WeatherCondition;
  precipProbability?: number; // 0–100
}

/** One hour of forecast data for the 24-hour timeline. */
export interface HourlyForecast {
  time: Date;
  condition: WeatherCondition;
  temp: number; // In WeatherUnits.temperature
  feelsLike: number; // In WeatherUnits.temperature
  precipProbability?: number; // 0–100
  precipIntensity?: number;   // in/hr or mm/hr, according to WeatherUnits
}

export interface ForecastPeriod {
  label: string;
  temp: number;
  condition: WeatherCondition;
}

/** One minute of precipitation data from the minutely forecast. */
export interface MinutelyData {
  time: number;           // unix timestamp
  precipIntensity: number;  // in/hr or mm/hr, according to WeatherUnits
  precipProbability: number; // 0–1
}

/**
 * Display units carried in every weather response. Determined by the user's
 * Display settings (Imperial vs Metric); falls back to imperial on legacy
 * installs that don't have the setting saved. Each field controls which
 * suffix the display components render — components don't convert values
 * themselves, so what you see is what the provider returned.
 */
export interface WeatherUnits {
  /** 'F' (default) or 'C'. Affects current.temperature, forecast hi/lo, hourly.temp, periods.temp, feelsLike. */
  temperature: 'F' | 'C';
  /** 'mph' (default) or 'km/h'. Affects current.windSpeed. */
  windSpeed: 'mph' | 'km/h';
  /** 'in' (default) or 'mm'. Affects current.precipitation, hourly.precipIntensity, minutely.precipIntensity. */
  precipitation: 'in' | 'mm';
}

function precipitationToMillimeters(value: number, units: WeatherUnits): number {
  return units.precipitation === 'in' ? value * MILLIMETERS_PER_INCH : value;
}

export type AirQualityCategory =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous';

export type AirQualityStatus = {
  label: AirQualityCategory;
  badgeClassName: string;
  dotClassName: string;
};

/**
 * EPA/AirNow PM2.5 concentration breakpoints. These are the familiar AQI
 * category bands, applied to the current monitor reading for a quick glance;
 * an official AQI is based on a time-averaged concentration.
 */
export function getAirQualityStatus(pm25: number): AirQualityStatus | null {
  if (!Number.isFinite(pm25) || pm25 < 0) return null;

  if (pm25 <= 9.0) {
    return {
      label: 'Good',
      badgeClassName:
        'border-emerald-500/80 bg-emerald-200 text-emerald-950 dark:border-emerald-300/80 dark:bg-emerald-400/35 dark:text-emerald-50',
      dotClassName: 'bg-emerald-700 dark:bg-emerald-300',
    };
  }
  if (pm25 <= 35.4) {
    return {
      label: 'Moderate',
      badgeClassName:
        'border-yellow-500/80 bg-yellow-200 text-yellow-950 dark:border-yellow-300/80 dark:bg-yellow-400/35 dark:text-yellow-50',
      dotClassName: 'bg-yellow-700 dark:bg-yellow-300',
    };
  }
  if (pm25 <= 55.4) {
    return {
      label: 'Unhealthy for Sensitive Groups',
      badgeClassName:
        'border-orange-500/80 bg-orange-200 text-orange-950 dark:border-orange-300/80 dark:bg-orange-400/35 dark:text-orange-50',
      dotClassName: 'bg-orange-700 dark:bg-orange-300',
    };
  }
  if (pm25 <= 125.4) {
    return {
      label: 'Unhealthy',
      badgeClassName:
        'border-red-500/80 bg-red-200 text-red-950 dark:border-red-300/80 dark:bg-red-400/35 dark:text-red-50',
      dotClassName: 'bg-red-700 dark:bg-red-300',
    };
  }
  if (pm25 <= 225.4) {
    return {
      label: 'Very Unhealthy',
      badgeClassName:
        'border-purple-500/80 bg-purple-200 text-purple-950 dark:border-purple-300/80 dark:bg-purple-400/35 dark:text-purple-50',
      dotClassName: 'bg-purple-700 dark:bg-purple-300',
    };
  }
  return {
    label: 'Hazardous',
    badgeClassName:
      'border-rose-500/80 bg-rose-200 text-rose-950 dark:border-rose-300/80 dark:bg-rose-400/35 dark:text-rose-50',
    dotClassName: 'bg-rose-700 dark:bg-rose-300',
  };
}
export type UvIndexCategory = 'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme';

export type UvIndexStatus = {
  label: UvIndexCategory;
  dotClassName: string;
  textClassName: string;
};

/** WHO/EPA UV Index bands, kept in one place so the indicator and its label agree. */
export function getUvIndexStatus(uvIndex: number): UvIndexStatus | null {
  if (!Number.isFinite(uvIndex) || uvIndex < 0) return null;

  if (uvIndex <= 2) {
    return {
      label: 'Low',
      dotClassName: 'bg-emerald-500 dark:bg-emerald-300',
      textClassName: 'text-emerald-700 dark:text-emerald-300',
    };
  }
  if (uvIndex <= 5) {
    return {
      label: 'Moderate',
      dotClassName: 'bg-yellow-500 dark:bg-yellow-300',
      textClassName: 'text-yellow-700 dark:text-yellow-300',
    };
  }
  if (uvIndex <= 7) {
    return {
      label: 'High',
      dotClassName: 'bg-orange-500 dark:bg-orange-300',
      textClassName: 'text-orange-700 dark:text-orange-300',
    };
  }
  if (uvIndex <= 10) {
    return {
      label: 'Very High',
      dotClassName: 'bg-red-500 dark:bg-red-300',
      textClassName: 'text-red-700 dark:text-red-300',
    };
  }
  return {
    label: 'Extreme',
    dotClassName: 'bg-purple-500 dark:bg-purple-300',
    textClassName: 'text-purple-700 dark:text-purple-300',
  };
}

function isSunAboveHorizon(sunrise?: Date, sunset?: Date, nowMs = Date.now()): boolean {
  if (!sunrise || !sunset) return true;

  const sunriseMs = new Date(sunrise).getTime();
  const sunsetMs = new Date(sunset).getTime();
  if (!Number.isFinite(sunriseMs) || !Number.isFinite(sunsetMs)) return true;

  return nowMs >= sunriseMs && nowMs <= sunsetMs;
}


export interface WeatherData {
  location: string;
  current: CurrentWeather;
  forecast: ForecastDay[];
  /** Currently active watches, warnings, advisories, or similar alerts. */
  alerts?: WeatherAlert[];
  /** Next 24 hours of hourly forecast data for the timeline. */
  hourly?: HourlyForecast[];
  periods?: ForecastPeriod[];
  /** Next 60 minutes of minute-by-minute precipitation data. */
  minutely?: MinutelyData[];
  sunrise?: Date;
  sunset?: Date;
  /** Moonrise for today in the location's timezone (computed locally via suncalc). */
  moonrise?: Date;
  /** Moonset for today in the location's timezone (computed locally via suncalc). */
  moonset?: Date;
  /** Phase angle 0..1 — 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter. */
  moonPhase?: number;
  /** Illuminated fraction 0..1 — independent of waxing vs waning. */
  moonIllumination?: number;
  /** Human-readable phase label, e.g. "Waning Gibbous". */
  moonPhaseName?: string;
  /** Latitude of the weather location — used client-side by suncalc to draw
   *  the sun/moon arcs at their true altitudes. */
  lat?: number;
  /** Longitude of the weather location. Pair with lat. */
  lon?: number;
  /** Units that the temperature/wind/precip fields are reported in. */
  units: WeatherUnits;
  /** Source of current readings; Pirate means the local sensor fallback is active. */
  currentSource?: WeatherCurrentSource;
  lastUpdated: Date;
}


/**
 * WEATHER WIDGET PROPS
 */
export interface WeatherWidgetProps {
  location?: string;
  /**
   * @deprecated Display units are now driven by `data.units` (server-side,
   * from the user's Display setting). The prop is still accepted for backward
   * compatibility but ignored. To show Celsius, change the Display setting.
   */
  useCelsius?: boolean;
  showForecast?: boolean;
  /** Number of upcoming days to display in the multi-day summary (1–7, default 5) */
  forecastDays?: number;
  data?: WeatherData;
  loading?: boolean;
  error?: string | null;
  gridW?: number;
  gridH?: number;
  className?: string;
}


/**
 * MOON PHASE GLYPH GEOMETRY (shared)
 *
 * Returns an SVG path string for the illuminated portion of the moon at the
 * given phase: a half-circle on the lit side plus an elliptical arc whose
 * x-radius shrinks toward zero at the quarter phases. At new moon (phase=0)
 * the two arcs overlap and the closed path has zero area — caller should
 * combine with an outlined disc so new moon reads as an empty circle.
 *
 * Used in two places: inline in the SunriseSunsetArc SVG, and as the body
 * of the standalone <MoonGlyph> component (forecast day rows).
 */
function moonPhasePath(cx: number, cy: number, r: number, phase: number): string {
  const ph = ((phase % 1) + 1) % 1;
  const rxAbs = Math.abs(Math.cos(2 * Math.PI * ph)) * r;
  const outerSweep = ph < 0.5 ? 1 : 0;
  const innerSweep = Math.floor(ph * 4) % 2 === 1 ? 1 : 0;
  return `M ${cx},${cy - r} A ${r},${r} 0 0 ${outerSweep} ${cx},${cy + r} A ${rxAbs},${r} 0 0 ${innerSweep} ${cx},${cy - r} Z`;
}

/**
 * Small standalone moon glyph — outlined disc + lit fraction. Used next to
 * each forecast day to show the night's moon phase at a glance.
 */
function MoonGlyph({
  phase,
  size = 14,
  color = '#60A5FA',
}: {
  phase: number;
  size?: number;
  color?: string;
}) {
  const r = size / 2 - 0.5;
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={c} cy={c} r={r} fill="none" stroke={color}
        strokeOpacity={0.5} strokeWidth={0.8} />
      <path d={moonPhasePath(c, c, r, phase)} fill={color} opacity={0.9} />
    </svg>
  );
}


/**
 * ABSOLUTE TEMPERATURE COLOR SCALE
 * Maps a Fahrenheit value to a color on a fixed scale.
 * Since ForecastDay temps are always stored in °F, this works for both
 * display units — pass the raw °F value regardless of useCelsius.
 */
const TEMP_COLOR_STOPS: Array<{ temp: number; rgb: [number, number, number] }> = [
  { temp:  0, rgb: [147, 197, 253] }, // blue-300    — very cold
  { temp: 32, rgb: [ 96, 165, 250] }, // blue-400    — freezing
  { temp: 45, rgb: [103, 232, 249] }, // cyan-300    — cold
  { temp: 55, rgb: [134, 239, 172] }, // green-300   — cool
  { temp: 65, rgb: [253, 230, 138] }, // amber-200   — mild
  { temp: 75, rgb: [252, 211,  77] }, // amber-300   — warm
  { temp: 85, rgb: [249, 115,  22] }, // orange-500  — hot
  { temp: 95, rgb: [239,  68,  68] }, // red-500     — very hot
];

function tempToColor(fahrenheit: number): string {
  const stops = TEMP_COLOR_STOPS;
  if (fahrenheit <= stops[0]!.temp) {
    const [r, g, b] = stops[0]!.rgb;
    return `rgb(${r},${g},${b})`;
  }
  if (fahrenheit >= stops[stops.length - 1]!.temp) {
    const [r, g, b] = stops[stops.length - 1]!.rgb;
    return `rgb(${r},${g},${b})`;
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (fahrenheit >= a.temp && fahrenheit <= b.temp) {
      const t = (fahrenheit - a.temp) / (b.temp - a.temp);
      const r = Math.round(a.rgb[0] + t * (b.rgb[0] - a.rgb[0]));
      const g = Math.round(a.rgb[1] + t * (b.rgb[1] - a.rgb[1]));
      const bl = Math.round(a.rgb[2] + t * (b.rgb[2] - a.rgb[2]));
      return `rgb(${r},${g},${bl})`;
    }
  }
  const [r, g, b] = stops[stops.length - 1]!.rgb;
  return `rgb(${r},${g},${b})`;
}


function formatTemp(value: number, units: WeatherUnits): string {
  return units.temperature === 'C'
    ? `${Math.round(value)}°C`
    : `${Math.round(value)}°`;
}

function formatCompactNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatVisibility(value: number, units: WeatherUnits): string {
  const unit = units.temperature === 'C' ? 'km' : 'mi';
  return `${formatCompactNumber(value)} ${unit}`;
}

/** Convert a temperature value (in either F or C) to the F scale tempToColor expects. */
function toFahrenheitForColor(value: number, units: WeatherUnits): number {
  return units.temperature === 'C' ? value * 9 / 5 + 32 : value;
}

const US_STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
  kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA',
  michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY',
};

/** Normalize upstream location labels to "City, ST" and omit postal codes. */
function formatLocation(location: string): string {
  const withoutPostalCode = location.trim().replace(/\s+\d{4,10}(?:-\d{4})?\s*$/, '');
  const parts = withoutPostalCode.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;

  const city = parts[0]!;
  const region = parts[1]!;
  const normalizedRegion = US_STATE_ABBREVIATIONS[region.toLowerCase()] ?? region;
  const country = parts[parts.length - 1]!.toLowerCase();
  const isCountryOnly = parts.length === 2 && (country === 'us' || country === 'usa' || country === 'united states');

  return isCountryOnly ? city : `${city}, ${normalizedRegion}`;
}

function formatTempDisplay(fahrenheit: number, useCelsius: boolean): string {
  if (useCelsius) {
    return `${Math.round((fahrenheit - 32) * 5 / 9)}°C`;
  }
  return `${Math.round(fahrenheit)}°F`;
}


/**
 * WEATHER WIDGET COMPONENT
 */
export const WeatherWidget = React.memo(function WeatherWidget({
  location = '',
  useCelsius = false,
  showForecast = true,
  forecastDays,
  data: externalData,
  loading = false,
  error = null,
  gridW = 12,
  gridH = 12,
  className,
}: WeatherWidgetProps) {
  const weatherData = externalData || getDemoWeatherData(location);
  const units = weatherData.units;

  const isVertical = gridH > gridW;

  // Auto-fit the content to the widget's height so it never overflows/clips in a
  // short cell: reveal sections densest-first (current conditions → hourly
  // timeline → N-day forecast) as more rows are available. An explicit
  // forecastDays prop (a user setting) overrides the automatic day count, and
  // the thresholds are deliberately conservative so it fits even on shorter
  // (laptop-height) rows. Give it more rows in the editor to see more days.
  const autoDays =
    gridH >= 20 ? 7 :
    gridH >= 16 ? 5 :
    gridH >= 13 ? 4 :
    gridH >= 10 ? 3 :
    gridH >= 8 ? 2 : 0;
  const resolvedDays = Math.max(0, forecastDays ?? autoDays);
  // Hourly is an extra that eats the forecast's space; only show it when the
  // widget is tall enough (matches the sun/moon arc). Below that, favor the
  // daily forecast so it isn't squeezed to a single clipped row.
  const showHourly = showForecast && gridH >= 12;

  // The daily forecast is a vertical list of fixed-height rows. Measure the space
  // it actually has and render only WHOLE rows, so a day is never cut in half at
  // the bottom (which looks broken on a kiosk). Falls back to showing all days
  // when unmeasured (SSR/tests, where clientHeight is 0).
  const dayListRef = React.useRef<HTMLDivElement>(null);
  const [maxDayRows, setMaxDayRows] = React.useState(7);
  React.useEffect(() => {
    const el = dayListRef.current;
    if (!el) return;
    const measure = () => {
      // Measure the REAL row height instead of a hardcoded 44 — the row is a
      // hair taller than that, and the widget's height differs between the
      // editor's square cells and the display's stretched 1fr rows, so a fixed
      // estimate over-counts and half-clips the last row in view mode only.
      // getBoundingClientRect keeps container + row in one coordinate space so
      // any dashboard transform-scale cancels. -6 absorbs the list's small top
      // margin + sub-pixel rounding so we round DOWN to whole rows.
      const h = el.getBoundingClientRect().height;
      if (h <= 0) return;
      const row = el.querySelector('[data-day-row]');
      const rowH = row ? row.getBoundingClientRect().height : 44;
      if (rowH <= 0) return;
      setMaxDayRows(Math.max(1, Math.floor((h - 6) / rowH)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showForecast, resolvedDays, gridH]);

  // Pre-filter to today-or-future so the label count matches what renders.
  // Provider stores forecast.date as UTC-midnight of the location's calendar
  // day (see openmeteo.ts comment), so read via getUTC* to compare against
  // the viewer's local-today calendar string.
  const now = new Date();
  const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const visibleForecast = weatherData.forecast.slice(0, resolvedDays).filter((day) => {
    const d = new Date(day.date);
    const s = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    return s >= todayLocalStr;
  });
  // Only the days that fit as whole rows (see maxDayRows above).
  const shownForecast = visibleForecast.slice(0, maxDayRows);

  const hasDays = weatherData.forecast.length > 0;

  // Show precipitation chart only for real rain (≥ 0.1 mm/hr); convert first
  // because Pirate Weather returns inches/hour for imperial installs.
  const hasImminentRain = (weatherData.minutely ?? []).some((m) =>
    precipitationToMillimeters(m.precipIntensity, units) >= RAIN_THRESHOLD_MM_PER_HOUR
  );
  const showPrecipChart = hasImminentRain && !!weatherData.minutely?.length;
  // The sun/moon arc is a nice-to-have; only show it when the widget is tall
  // enough that it doesn't squeeze the actual forecast. Below that, favor the
  // forecast (e.g. the small weather tile on School Mornings).
  const showSunArc = !!weatherData.sunrise && !!weatherData.sunset && !showPrecipChart && gridH >= 12;

  return (
    <WidgetContainer
      widgetType="Weather"
      icon={<Cloud className="h-4 w-4" />}
      size="medium"
      loading={loading}
      error={error}
      className={className}
    >
      <div className={cn('flex flex-col gap-3 h-full overflow-hidden', isVertical ? 'pb-2' : '')}>

        {/* CURRENT CONDITIONS */}
        <CurrentConditions
          weather={weatherData.current}
          location={weatherData.location}
          units={units}
          hourly={weatherData.hourly}
          currentSource={weatherData.currentSource}
          sunrise={weatherData.sunrise}
          sunset={weatherData.sunset}
        />

        {weatherData.alerts && weatherData.alerts.length > 0 && (
          <WeatherAlerts alerts={weatherData.alerts} />
        )}

        {/* HOURLY FORECAST */}
        {showHourly && weatherData.hourly && weatherData.hourly.length > 0 && (
          <div className="border-t border-border/45 pt-4">
            <HourlyTimeline hourly={weatherData.hourly} units={units} />
          </div>
        )}

        {/* FORECAST SECTION */}
        {showForecast && hasDays && resolvedDays > 0 && (
          <div
            className={cn(
              'wall-weather-forecast border-t border-border/45 pt-4 flex-1 min-h-0 flex flex-col gap-3',
              gridH < 16 && 'wall-weather-forecast-compact',
            )}
          >

            {/* Multi-day summary — the day list fills the remaining space and
                clips to WHOLE rows (maxDayRows) so a day is never half-cut. */}
            <div className="flex-1 min-h-0 flex flex-col">
              <span className="flex-shrink-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {shownForecast.length}-Day Forecast
              </span>
              <div ref={dayListRef} className="flex-1 min-h-0 overflow-hidden">
                <DayHeader days={shownForecast} units={units} />
              </div>
            </div>

            {/* Sun + moon arc — replaced by precip chart when rain is imminent. */}
            {showSunArc && (
              <div className="flex-shrink-0 flex flex-col gap-1">
                <SunriseSunsetArc
                  sunrise={weatherData.sunrise!}
                  sunset={weatherData.sunset!}
                  lat={weatherData.lat}
                  lon={weatherData.lon}
                  moonrise={weatherData.moonrise}
                  moonset={weatherData.moonset}
                  moonPhase={weatherData.moonPhase}
                />
              </div>
            )}

            {/* Precipitation chart — replaces sunrise/sunset arc when rain is coming in the next hour */}
            {showPrecipChart && (
              <div className="flex-shrink-0 flex flex-col gap-1">
                <PrecipitationChart
                  minutely={weatherData.minutely!}
                  units={units}
                />
              </div>
            )}

          </div>
        )}
      </div>
    </WidgetContainer>
  );
});


function getWeatherAlertTone(severity: WeatherAlertSeverity) {
  switch (severity) {
    case 'extreme':
    case 'severe':
      return {
        container: 'border-red-500/80 bg-red-500/15 text-red-950 dark:border-red-300/70 dark:bg-red-500/20 dark:text-red-50',
        icon: 'text-red-600 dark:text-red-300',
      };
    case 'moderate':
      return {
        container: 'border-orange-500/80 bg-orange-500/15 text-orange-950 dark:border-orange-300/70 dark:bg-orange-500/20 dark:text-orange-50',
        icon: 'text-orange-600 dark:text-orange-300',
      };
    case 'minor':
      return {
        container: 'border-yellow-500/80 bg-yellow-400/20 text-yellow-950 dark:border-yellow-300/70 dark:bg-yellow-400/20 dark:text-yellow-50',
        icon: 'text-yellow-600 dark:text-yellow-300',
      };
    default:
      return {
        container: 'border-amber-500/80 bg-amber-400/15 text-amber-950 dark:border-amber-300/70 dark:bg-amber-400/20 dark:text-amber-50',
        icon: 'text-amber-600 dark:text-amber-300',
      };
  }
}

function formatAlertEnd(end?: Date): string {
  if (!end || !Number.isFinite(new Date(end).getTime())) return 'Active now';

  const now = new Date();
  const endDate = new Date(end);
  const sameDay = now.toDateString() === endDate.toDateString();
  const time = endDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return sameDay
    ? `Until ${time}`
    : `Through ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function WeatherAlerts({ alerts }: { alerts: WeatherAlert[] }) {
  const visibleAlerts = alerts.slice(0, 2);

  return (
    <div
      data-testid="weather-alerts"
      aria-label={`${alerts.length} active weather alert${alerts.length === 1 ? '' : 's'}`}
      className="flex flex-col gap-1.5"
    >
      {visibleAlerts.map((alert) => {
        const tone = getWeatherAlertTone(alert.severity);
        const details = alert.description || alert.instruction || alert.headline;

        return (
          <div
            key={alert.id}
            role="alert"
            aria-label={`${alert.title} active weather alert`}
            title={details}
            className={cn(
              'flex min-w-0 items-start gap-2 rounded-md border px-2.5 py-1.5',
              tone.container,
            )}
          >
            <AlertTriangle className={cn('h-5 w-5 flex-shrink-0 self-center', tone.icon)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-baseline justify-between gap-2">
                <span className="truncate text-xs font-bold uppercase tracking-wide">{alert.title}</span>
                <span className="shrink-0 text-xs font-medium opacity-80">{formatAlertEnd(alert.end)}</span>
              </div>
              {alert.headline && (
                <div className="truncate text-xs leading-4 opacity-90">{alert.headline}</div>
              )}
            </div>
          </div>
        );
      })}

      {alerts.length > visibleAlerts.length && (
        <span className="px-1 text-xs font-medium text-muted-foreground">
          +{alerts.length - visibleAlerts.length} more active alert{alerts.length - visibleAlerts.length === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}


/**
 * CURRENT CONDITIONS SECTION
 */
function CurrentConditions({
  weather,
  location,
  units,
  hourly,
  currentSource,
  sunrise,
  sunset,
}: {
  weather: CurrentWeather;
  location: string;
  units: WeatherUnits;
  hourly?: HourlyForecast[];
  currentSource?: WeatherCurrentSource;
  sunrise?: Date;
  sunset?: Date;
}) {
  const temp  = formatTemp(weather.temperature, units);
  const feels = formatTemp(weather.feelsLike, units);
  const temperatureTrend = getTemperatureTrend(weather.temperature, hourly);
  const sunIsAboveHorizon = isSunAboveHorizon(sunrise, sunset);
  const airQualityStatus = weather.airQuality?.pm25 !== undefined
    ? getAirQualityStatus(weather.airQuality.pm25)
    : null;

  return (
    <div
      data-testid="weather-current-header"
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3"
    >
      {/* Keep both columns top-aligned, with compact, consistent line spacing
          inside each stack so the header does not grow around the large temp. */}
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <WeatherIcon
            condition={weather.condition}
            className="h-10 w-10 text-amber-500 dark:text-amber-300 flex-shrink-0"
          />
          <div className="min-w-0">
            <div
              data-testid="weather-current-temperature"
              aria-label={`${temp}${temperatureTrend ? ` & ${temperatureTrend}` : ''}`}
              className="flex items-baseline gap-2"
            >
              <div className="flex items-center gap-2">
                <div className="text-5xl font-bold leading-none">{temp}</div>
                {currentSource === 'pirate' && (
                  <span
                    data-testid="weather-fallback-indicator"
                    role="img"
                    aria-label="Using Pirate Weather fallback data"
                    title="Using Pirate Weather fallback data"
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-red-500"
                  />
                )}
              </div>
              {temperatureTrend && (
                <span
                  data-testid="weather-temperature-trend"
                  className="whitespace-nowrap text-lg font-semibold leading-none text-muted-foreground"
                >
                  &amp; {temperatureTrend}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-lg leading-6 text-muted-foreground">Feels like {feels}</div>
        {airQualityStatus && weather.airQuality?.pm25 !== undefined && (
          <div
            className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground"
            title="PM2.5 category based on EPA AQI breakpoints; current reading, not a 24-hour average"
          >
            <span
              data-testid="air-quality-badge"
              aria-label={`Air quality: ${airQualityStatus.label}`}
              title={airQualityStatus.label}
              className={cn(
                'inline-flex max-w-[150px] items-center gap-1.5 truncate rounded-full border px-2 py-1 text-[13px] font-semibold leading-none',
                airQualityStatus.badgeClassName,
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', airQualityStatus.dotClassName)} />
              Air: {airQualityStatus.label}
            </span>
            <span className="text-[13px] tabular-nums">{weather.airQuality.pm25} µg/m³</span>
          </div>
        )}
      </div>

      {/* Right: current stats */}
      <div
        data-testid="weather-current-stats"
        className="flex flex-col items-end gap-1.5 pt-0.5 text-right text-[14px] leading-5 text-muted-foreground"
      >
        <div data-testid="weather-humidity-dewpoint" className="flex items-center justify-end gap-2">
          <div className="flex items-center gap-1">
            <Droplets className="h-3 w-3" />
            <span>{weather.humidity}%</span>
          </div>
          {weather.dewPoint !== undefined && (
            <div className="flex items-center gap-1">
              <Thermometer className="h-3 w-3" />
              <span>Dew point {formatTemp(weather.dewPoint, units)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-1">
          <Wind className="h-3 w-3" />
          <span>
            {weather.windSpeed} {units.windSpeed}
            {weather.windGust !== undefined && ` · Gusts ${weather.windGust} ${units.windSpeed}`}
          </span>
        </div>
        {weather.uvIndex !== undefined && sunIsAboveHorizon && (
          <UvIndexLine uvIndex={weather.uvIndex} />
        )}
        {weather.visibility !== undefined && (
          <div className="flex items-center justify-end gap-1">
            <Eye className="h-3 w-3" />
            <span>Visibility {formatVisibility(weather.visibility, units)}</span>
          </div>
        )}
        {location && (
          <div className="flex max-w-[140px] items-center justify-end truncate">
            {formatLocation(location)}
          </div>
        )}
      </div>
    </div>
  );
}


/** Keep UV as a single compact stat, with a warning dot for Moderate and above. */
function UvIndexLine({ uvIndex }: { uvIndex: number }) {
  const status = getUvIndexStatus(uvIndex);
  if (!status) return null;

  const displayValue = formatCompactNumber(uvIndex);
  const showWarningDot = uvIndex > 2;
  const shouldPulse = uvIndex > 5;

  return (
    <div
      data-testid="uv-index-line"
      className={cn('flex items-center justify-end gap-1', status.textClassName)}
      title={`UV index ${displayValue}: ${status.label}`}
      aria-label={`UV index ${displayValue}, ${status.label}`}
    >
      {showWarningDot && (
        <span
          data-testid="uv-index-dot"
          className={cn(
            'h-2 w-2 rounded-full',
            status.dotClassName,
            shouldPulse && 'uv-index-dot--pulse',
          )}
          aria-hidden="true"
        />
      )}
      <span>UV {displayValue}</span>
    </div>
  );
}

/**
 * WEATHER ICON
 */
function WeatherIcon({
  condition,
  className,
}: {
  condition: WeatherCondition;
  className?: string;
}) {
  const icons: Record<WeatherCondition, React.ReactNode> = {
    'sunny':         <Sun className={className} />,
    'partly-cloudy': <CloudSun className={className} />,
    'cloudy':        <Cloud className={className} />,
    'rainy':         <CloudRain className={className} />,
    'snowy':         <CloudSnow className={className} />,
    'stormy':        <Zap className={className} />,
  };
  return <>{icons[condition] ?? <Cloud className={className} />}</>;
}


/**
 * CONDITION HELPERS
 */

/** Map a WeatherCondition (+ optional precipIntensity) to a concise label. */
function conditionLabel(condition: WeatherCondition, precipIntensity?: number): string {
  if (condition === 'rainy' && precipIntensity !== undefined) {
    if (precipIntensity < 0.1) return 'Drizzle';
    if (precipIntensity < 2.5) return 'Light Rain';
    if (precipIntensity < 10)  return 'Rain';
    return 'Heavy Rain';
  }
  const map: Record<WeatherCondition, string> = {
    'sunny':         'Clear',
    'partly-cloudy': 'Partly Cloudy',
    'cloudy':        'Cloudy',
    'rainy':         'Rain',
    'snowy':         'Snow',
    'stormy':        'Thunderstorm',
  };
  return map[condition] ?? 'Cloudy';
}

/** Short labels keep narrow condition bands legible without losing meaning. */
function conditionBandShortLabel(condition: WeatherCondition, precipIntensity?: number): string {
  if (condition === 'partly-cloudy') return 'Partly';
  if (condition === 'stormy') return 'Storms';
  return conditionLabel(condition, precipIntensity);
}

function conditionBandClass(condition: WeatherCondition): string {
  const classes: Record<WeatherCondition, string> = {
    'sunny': 'weather-condition-band-sunny',
    'partly-cloudy': 'weather-condition-band-partly-cloudy',
    'cloudy': 'weather-condition-band-cloudy',
    'rainy': 'weather-condition-band-rainy',
    'snowy': 'weather-condition-band-snowy',
    'stormy': 'weather-condition-band-stormy',
  };
  return classes[condition];
}

function conditionIconClass(condition: WeatherCondition): string {
  const classes: Record<WeatherCondition, string> = {
    sunny: 'weather-condition-icon-sunny',
    'partly-cloudy': 'weather-condition-icon-partly-cloudy',
    cloudy: 'weather-condition-icon-cloudy',
    rainy: 'weather-condition-icon-rainy',
    snowy: 'weather-condition-icon-snowy',
    stormy: 'weather-condition-icon-stormy',
  };
  return classes[condition];
}

function ConditionBandLabel({
  condition,
  precipIntensity,
  className,
  style,
}: {
  condition: WeatherCondition;
  precipIntensity?: number;
  className: string;
  style: React.CSSProperties;
}) {
  const fullLabel = conditionLabel(condition, precipIntensity);
  const shortLabel = conditionBandShortLabel(condition, precipIntensity);
  const bandRef = React.useRef<HTMLDivElement>(null);
  const fullLabelRef = React.useRef<HTMLSpanElement>(null);
  const [showFullLabel, setShowFullLabel] = React.useState(fullLabel === shortLabel);

  React.useEffect(() => {
    if (fullLabel === shortLabel) {
      setShowFullLabel(true);
      return;
    }

    const band = bandRef.current;
    const fullLabelElement = fullLabelRef.current;
    if (!band || !fullLabelElement) return;

    const updateLabel = () => {
      const computedStyle = window.getComputedStyle(band);
      const horizontalPadding = parseFloat(computedStyle.paddingLeft || '0')
        + parseFloat(computedStyle.paddingRight || '0');
      const availableWidth = band.clientWidth - horizontalPadding;
      setShowFullLabel(fullLabelElement.getBoundingClientRect().width <= availableWidth);
    };

    updateLabel();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateLabel);
    observer.observe(band);
    return () => observer.disconnect();
  }, [fullLabel, shortLabel]);

  return (
    <div
      ref={bandRef}
      className={className}
      style={style}
      data-condition-band={condition}
    >
      {fullLabel !== shortLabel && (
        <span
          ref={fullLabelRef}
          className="pointer-events-none absolute invisible w-max whitespace-nowrap text-[15px] font-medium"
          aria-hidden="true"
          data-condition-measure="true"
        >
          {fullLabel}
        </span>
      )}
      <span
        className="truncate text-[15px] font-medium text-foreground"
        data-condition-label={condition}
      >
        {showFullLabel ? fullLabel : shortLabel}
      </span>
    </div>
  );
}


/**
 * HOURLY FORECAST
 * Five evenly sampled moments from the next nine hours. A quiet, theme-aware
 * panel reads more naturally on pale widget surfaces than a saturated stripe,
 * while retaining the useful at-a-glance time, condition, temperatures, and
 * precipitation chance.
 */
function HourlyTimeline({ hourly, units }: { hourly: HourlyForecast[]; units: WeatherUnits }) {
  const nowMs = Date.now();

  const upcoming = React.useMemo(() =>
    hourly
      .filter((h) => h.time.getTime() + 60 * 60_000 >= nowMs)
      .slice(0, 9),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [hourly]);

  if (upcoming.length === 0) return null;

  const sampleIndexes = Array.from(new Set([0, 2, 4, 6, upcoming.length - 1]))
    .filter((index) => index < upcoming.length)
    .sort((a, b) => a - b);
  const samples = sampleIndexes.map((index) => upcoming[index]!);

  const conditionBands = upcoming.reduce<Array<{
    condition: WeatherCondition;
    precipIntensity?: number;
    hours: number;
  }>>((bands, hour) => {
    const previous = bands[bands.length - 1];
    const label = conditionLabel(hour.condition, hour.precipIntensity);
    if (previous && conditionLabel(previous.condition, previous.precipIntensity) === label) {
      previous.hours += 1;
    } else {
      bands.push({
        condition: hour.condition,
        precipIntensity: hour.precipIntensity,
        hours: 1,
      });
    }
    return bands;
  }, []);

  const formatHour = (date: Date) => date
    .toLocaleTimeString([], { hour: 'numeric', hour12: true })
    .replace(' ', '')
    .toLowerCase();
  const formatTemperature = (temperature: number) => units.temperature === 'C'
    ? Math.round((temperature - 32) * 5 / 9)
    : Math.round(temperature);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Next 9 Hours
      </span>
      <div
        className="overflow-hidden rounded-2xl border border-border/40 bg-background/20 shadow-none"
        data-keep-bg=""
      >
        <div className="flex min-h-8 border-b border-border/35" aria-label="Hourly conditions">
          {conditionBands.map((band, index) => (
            <ConditionBandLabel
              key={`${band.condition}-${index}`}
              className={cn(
                'relative flex min-w-0 items-center justify-center border-r border-border/35 px-1.5 py-1.5 last:border-r-0',
                conditionBandClass(band.condition)
              )}
              style={{ flex: band.hours }}
              condition={band.condition}
              precipIntensity={band.precipIntensity}
            />
          ))}
        </div>

        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${samples.length}, minmax(0, 1fr))` }}
        >
          {samples.map((hour, index) => {
            const label = conditionLabel(hour.condition, hour.precipIntensity);

            return (
              <div
                key={hour.time.getTime()}
                data-testid="hourly-sample"
                className={cn(
                  'relative flex min-w-0 flex-col items-center gap-1.5 px-1 py-3 text-center',
                  index > 0 && 'border-l border-border/35',
                  index === 0 && 'bg-foreground/[0.05]'
                )}
                aria-label={`${index === 0 ? 'Now' : formatHour(hour.time)}, ${label}, ${formatTemperature(hour.temp)} degrees, feels like ${formatTemperature(hour.feelsLike)} degrees${hour.precipProbability !== undefined ? `, ${Math.round(hour.precipProbability)} percent chance of rain` : ''}`}
              >
                {index === 0 && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-400 dark:bg-amber-300" aria-hidden />
                )}
                <span className="text-[15px] font-semibold text-muted-foreground">
                  {index === 0 ? 'Now' : formatHour(hour.time)}
                </span>
                <WeatherIcon condition={hour.condition} className={`my-0.5 h-5 w-5 ${conditionIconClass(hour.condition)}`} />
                <span
                  className="text-[15px] font-semibold leading-none tabular-nums text-foreground"
                  title="Actual temperature | feels-like temperature"
                >
                  {formatTemperature(hour.temp)}° <span className="text-muted-foreground/70" aria-hidden>|</span> {formatTemperature(hour.feelsLike)}°
                </span>
                {hour.precipProbability !== undefined && (
                  <span
                    className="pt-0.5 text-[13px] leading-none tabular-nums text-muted-foreground"
                    title="Chance of precipitation"
                  >
                    {Math.round(hour.precipProbability)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


/**
 * PRECIPITATION CHART
 * Dark Sky-inspired smooth SVG area chart showing minute-by-minute
 * precipitation intensity over the next 60 minutes. Y-axis shows HEAVY / MED
 * / LIGHT intensity bands with dotted reference lines; x-axis shows 10-minute
 * interval labels. The curve is intentionally smooth and gently animated so
 * it reads as a living rain wave rather than a stack of bars.
 */
function PrecipitationChart({
  minutely,
  units,
}: {
  minutely: MinutelyData[];
  units: WeatherUnits;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(220);
  const gradientId = `precip-gradient-${React.useId().replace(/:/g, '')}`;

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const PAD_LEFT  = 4;
  const PAD_RIGHT = 4;
  const PAD_TOP   = 4;
  const CHART_H   = 60;
  const AXIS_H    = 22;
  const totalH    = PAD_TOP + CHART_H + AXIS_H;
  const chartW    = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const baseY     = PAD_TOP + CHART_H;

  // The provider gives a physical rate, not a display percentage. A
  // square-root mapping keeps the low end readable while reserving headroom
  // for genuinely heavy rain: 0.0583 in/hr ≈ 44% and 0.1343 in/hr ≈ 67%.
  const MAX_MM = PRECIPITATION_FULL_SCALE_MM_PER_HOUR;
  const intensityToY = (intensity: number) => {
    const normalized = Math.min(precipitationToMillimeters(intensity, units), MAX_MM) / MAX_MM;
    return baseY - Math.sqrt(normalized) * CHART_H;
  };

  // The guides are a visual intensity grid, independent of the nonlinear
  // rain-rate mapping. Keeping the three rows evenly spaced makes the chart
  // easy to scan even though the data-to-height curve is not linear.
  const GUIDE_STEP    = CHART_H / 3;
  const HEAVY_LINE_Y  = PAD_TOP;
  const MED_LINE_Y    = PAD_TOP + GUIDE_STEP;
  const LIGHT_LINE_Y  = PAD_TOP + GUIDE_STEP * 2;
  const HEAVY_LABEL_Y = HEAVY_LINE_Y + 8;
  const MED_LABEL_Y   = MED_LINE_Y + 8;
  const LIGHT_LABEL_Y = LIGHT_LINE_Y + 8;

  // Convert the provider values to points in the calibrated mm/hr scale, then
  // smooth short-lived spikes before the spline is generated. This keeps the
  // curve responsive to real changes without drawing every noisy sample.
  const n = minutely.length;
  const points = minutely.map((m, i) => ({
    x: PAD_LEFT + (i / Math.max(n - 1, 1)) * chartW,
    y: intensityToY(m.precipIntensity),
  }));
  const smoothedPoints = smoothPrecipitationPoints(points);
  const undulationPoints = precipitationUndulationPoints(
    smoothedPoints,
    0.35,
    PRECIPITATION_WAVE_UNDULATION_PX,
    PAD_TOP,
    baseY
  );
  const alternateUndulationPoints = precipitationUndulationPoints(
    smoothedPoints,
    2.45,
    PRECIPITATION_WAVE_UNDULATION_PX,
    PAD_TOP,
    baseY
  );
  const linePath = precipitationWavePath(undulationPoints, PAD_TOP, baseY);
  const alternateLinePath = precipitationWavePath(alternateUndulationPoints, PAD_TOP, baseY);
  // Keep the provider's forecast as the primary signal, then add a stable,
  // symmetric ±5% companion trace. It gives the wall display the organic
  // Dark Sky feel while honestly suggesting that minute-by-minute rain timing
  // is an estimate rather than a perfectly certain line.
  const variationPoints = smoothedPoints.map((point, i) => {
    const variation =
      (Math.sin(i * PRECIPITATION_WAVE_PRIMARY_FREQUENCY + 0.8) * 0.7 +
        Math.sin(i * PRECIPITATION_WAVE_SECONDARY_FREQUENCY) * 0.3) *
      CHART_H *
      PRECIPITATION_VARIATION_FRACTION;
    return {
      ...point,
      y: Math.max(PAD_TOP, Math.min(baseY, point.y + variation)),
    };
  });
  const variationPath = precipitationWavePath(variationPoints, PAD_TOP, baseY);
  const areaPath = linePath
    ? `${linePath} L ${(PAD_LEFT + chartW).toFixed(1)} ${baseY} L ${PAD_LEFT.toFixed(1)} ${baseY} Z`
    : '';
  const alternateAreaPath = alternateLinePath
    ? `${alternateLinePath} L ${(PAD_LEFT + chartW).toFixed(1)} ${baseY} L ${PAD_LEFT.toFixed(1)} ${baseY} Z`
    : '';

  const xTicks = [10, 20, 30, 40, 50].map((min) => ({
    min,
    x: PAD_LEFT + (min / 60) * chartW,
  }));

  const firstRainMinute = minutely.findIndex((m) =>
    precipitationToMillimeters(m.precipIntensity, units) >= RAIN_THRESHOLD_MM_PER_HOUR
  );
  const currentlyRaining = firstRainMinute === 0;

  const rainMessage = (() => {
    if (currentlyRaining) {
      const stopMinute = minutely.findIndex((m, i) =>
        i > 0 && precipitationToMillimeters(m.precipIntensity, units) < RAIN_THRESHOLD_MM_PER_HOUR
      );
      if (stopMinute === -1) return 'Raining through the hour';
      const resumeMinute = minutely.findIndex((m, i) =>
        i > stopMinute && precipitationToMillimeters(m.precipIntensity, units) >= RAIN_THRESHOLD_MM_PER_HOUR
      );
      return resumeMinute === -1
        ? `Stops in ${stopMinute} min`
        : `Stops in ${stopMinute} min · returns in ${resumeMinute} min`;
    }
    return firstRainMinute > 0 ? `Rain expected in ${firstRainMinute} min` : 'Rain starting now';
  })();

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center justify-between gap-4"
        data-precipitation-header
      >
        <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          Next hour
        </span>
        <span className="precipitation-wave-message shrink-0 text-right text-[12px] font-medium">
          {rainMessage}
        </span>
      </div>
      <div ref={containerRef} className="w-full">
        <svg
          width={width}
          height={totalH}
          style={{ display: 'block' }}
          role="img"
          aria-label="Rain intensity forecast for the next hour"
          data-precipitation-scale={MAX_MM}
          data-precipitation-baseline={baseY}
          data-precipitation-undulation-px={PRECIPITATION_WAVE_UNDULATION_PX}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="hsl(var(--weather-precipitation))" stopOpacity="0.92" />
              <stop offset="100%" stopColor="hsl(var(--weather-precipitation))" stopOpacity="0.58" />
            </linearGradient>
          </defs>

          {/* Evenly spaced visual intensity guides. */}
          <line x1={PAD_LEFT} y1={HEAVY_LINE_Y} x2={PAD_LEFT + chartW} y2={HEAVY_LINE_Y}
            stroke="currentColor" strokeOpacity={0.25} strokeWidth={0.75} strokeDasharray="3 3"
            data-precipitation-guide="heavy" />
          <line x1={PAD_LEFT} y1={MED_LINE_Y} x2={PAD_LEFT + chartW} y2={MED_LINE_Y}
            stroke="currentColor" strokeOpacity={0.25} strokeWidth={0.75} strokeDasharray="3 3"
            data-precipitation-guide="medium" />
          <line x1={PAD_LEFT} y1={LIGHT_LINE_Y} x2={PAD_LEFT + chartW} y2={LIGHT_LINE_Y}
            stroke="currentColor" strokeOpacity={0.25} strokeWidth={0.75} strokeDasharray="3 3"
            data-precipitation-guide="light" />

          {/* Zone labels */}
          <text x={PAD_LEFT + 8} y={HEAVY_LABEL_Y} textAnchor="start" fontSize={9}
            fill="currentColor" fillOpacity={0.62} dominantBaseline="middle">Heavy</text>
          <text x={PAD_LEFT + 8} y={MED_LABEL_Y} textAnchor="start" fontSize={9}
            fill="currentColor" fillOpacity={0.62} dominantBaseline="middle">Med</text>
          <text x={PAD_LEFT + 8} y={LIGHT_LABEL_Y} textAnchor="start" fontSize={9}
            fill="currentColor" fillOpacity={0.62} dominantBaseline="middle">Light</text>

          {/* Filled wave — the soft area is the primary Dark Sky-style signal. */}
          {areaPath && (
            <path
              d={areaPath}
              fill={`url(#${gradientId})`}
              className="precipitation-wave-area"
              data-precipitation-area
            >
              {alternateAreaPath && (
                <animate
                  attributeName="d"
                  values={`${areaPath};${alternateAreaPath};${areaPath}`}
                  dur="3.2s"
                  repeatCount="indefinite"
                  calcMode="spline"
                  keyTimes="0;0.5;1"
                  keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
                  className="precipitation-wave-jitter-morph"
                  data-precipitation-jitter-morph
                />
              )}
            </path>
          )}

          {/* A restrained companion trace communicates forecast uncertainty. */}
          {variationPath && (
            <path
              d={variationPath}
              fill="none"
              stroke="hsl(var(--weather-precipitation))"
              strokeOpacity={0.46}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="precipitation-wave-variation"
              data-precipitation-variation
              data-precipitation-variation-percent={PRECIPITATION_VARIATION_FRACTION * 100}
            />
          )}

          {/* Top edge — a smooth, gently morphing line. */}
          {linePath && (
            <>
              <path
                d={linePath}
                fill="none"
                stroke="hsl(var(--weather-precipitation))"
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="precipitation-wave-line"
                data-precipitation-line
              >
                {alternateLinePath && (
                  <animate
                    attributeName="d"
                    values={`${linePath};${alternateLinePath};${linePath}`}
                    dur="3.2s"
                    repeatCount="indefinite"
                    calcMode="spline"
                    keyTimes="0;0.5;1"
                    keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
                    className="precipitation-wave-jitter-morph"
                    data-precipitation-jitter-morph
                  />
                )}
              </path>
            </>
          )}

          {/* Baseline */}
          <line x1={PAD_LEFT} y1={baseY} x2={PAD_LEFT + chartW} y2={baseY}
            stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} />

          {/* X-axis labels */}
          {xTicks.map(({ min, x }) => (
            <text key={min} x={x} y={baseY + 11} textAnchor="middle" fontSize={7.5}
              fill="currentColor" fillOpacity={0.5}>{min} min</text>
          ))}
        </svg>
      </div>
    </div>
  );
}

/** Apply a short weighted moving average without moving the endpoints. */
function smoothPrecipitationPoints(
  points: { x: number; y: number }[],
  passes = 2
): { x: number; y: number }[] {
  let smoothed = points;
  for (let pass = 0; pass < passes; pass++) {
    smoothed = smoothed.map((point, index) => {
      if (index === 0 || index === smoothed.length - 1) return point;
      const previous = smoothed[index - 1]!;
      const next = smoothed[index + 1]!;
      return {
        x: point.x,
        y: (previous.y + point.y * 2 + next.y) / 4,
      };
    });
  }
  return smoothed;
}

/** Add a broad, low-amplitude undulation without changing the endpoints. */
function precipitationUndulationPoints(
  points: { x: number; y: number }[],
  phase: number,
  amplitude = PRECIPITATION_WAVE_UNDULATION_PX,
  minY = 4,
  maxY = 64
): { x: number; y: number }[] {
  const lastIndex = Math.max(points.length - 1, 1);
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) {
      return {
        ...point,
        y: Math.max(minY, Math.min(maxY, point.y)),
      };
    }

    const edgeWeight = Math.sin((index / lastIndex) * Math.PI);
    const undulation =
      (Math.sin(index * PRECIPITATION_WAVE_PRIMARY_FREQUENCY + phase) * 0.7 +
        Math.sin(index * PRECIPITATION_WAVE_SECONDARY_FREQUENCY + phase * 0.9) * 0.3) *
      amplitude *
      edgeWeight;
    return {
      ...point,
      y: Math.max(minY, Math.min(maxY, point.y + undulation)),
    };
  });
}

/** Catmull-Rom spline → cubic Bézier path for a smooth, data-faithful wave. */
function precipitationWavePath(
  points: { x: number; y: number }[],
  minY = 0,
  maxY = Number.POSITIVE_INFINITY
): string {
  const clampY = (y: number) => Math.max(minY, Math.min(maxY, y));
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x.toFixed(1)} ${clampY(points[0]!.y).toFixed(1)}`;

  const path = [`M ${points[0]!.x.toFixed(1)} ${clampY(points[0]!.y).toFixed(1)}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = clampY(p2.y - (p3.y - p1.y) / 6);
    path.push(
      `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${clampY(p2.y).toFixed(1)}`
    );
  }
  return path.join(' ');
}


/**
 * SUN + MOON ARC
 *
 * Plots true celestial altitudes for both the sun and (optionally) the moon
 * across a 24-hour timeline (left edge = today's local midnight, right edge
 * = next midnight). Altitudes come from suncalc, so the visual peak height
 * of each arc reflects how high the body actually reaches in the sky on
 * the given day and latitude — summer sun arcs higher than winter sun,
 * and the moon arc varies with declination.
 *
 * Scale: π/2 (90°, the zenith) maps to `ryTop` pixels above the horizon;
 * sub-zenith altitudes shrink proportionally. Same scale below the horizon
 * capped at `ryBot`.
 *
 * Sun: amber for the elapsed portion of today (matches the prior look —
 * dashed background for future positions, slate-gray for elapsed below-
 * horizon nighttime).
 * Moon: blue for the entire above-horizon arc, with a phase-glyph dot at
 * the moon's current position. Below-horizon segments use the dashed
 * background only.
 */
function SunriseSunsetArc({
  sunrise,
  sunset,
  lat,
  lon,
  moonrise,
  moonset,
  moonPhase,
}: {
  sunrise: Date;
  sunset: Date;
  lat?: number;
  lon?: number;
  moonrise?: Date;
  moonset?: Date;
  moonPhase?: number;
}) {
  const [width, setWidth] = React.useState(220);
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Unique gradient ID so multiple weather widgets on a page (e.g., dashboard
  // + lite mode) don't share a single <defs> entry.
  const gradientId = `sun-grad-${React.useId()}`;
  const moonMaskId = `moon-mask-${React.useId()}`;

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H        = 110;
  const horizonY = 66;
  const pad      = 8;
  const arcWidth = width - 2 * pad;
  const ryTop    = horizonY - 10;      // pixels representing zenith (alt = π/2)
  const ryBot    = H - horizonY - 10;  // pixels representing antizenith (alt = -π/2)
  const midnightMs = useLocalDayStartMs();
  const nextMidnightMs = nextLocalDayStartMs(midnightMs);
  const dayMs = nextMidnightMs - midnightMs;
  const nowMs = Date.now();

  // X helper — frac 0..1 of today's 24h window maps to the SVG width.
  const xOf = (frac: number) => pad + frac * arcWidth;
  const nowFrac = Math.max(0, Math.min(1, (nowMs - midnightMs) / dayMs));

  // Map a celestial altitude (radians, -π/2..π/2) to a Y pixel.
  // FIXED scale: zenith = ryTop above horizonY. Sub-zenith altitudes shrink
  // proportionally so winter sun visibly arcs lower than summer sun.
  const altToY = React.useCallback((altRad: number): number => {
    if (altRad >= 0) return horizonY - ryTop * Math.min(1, altRad / (Math.PI / 2));
    return horizonY + ryBot * Math.min(1, -altRad / (Math.PI / 2));
  }, [horizonY, ryTop, ryBot]);

  // Resolve coords: fall back to Chicago for demo data without lat/lon.
  const useLat = lat ?? 41.8781;
  const useLon = lon ?? -87.6298;

  const samples = React.useMemo(() => {
    const sun: { frac: number; alt: number; y: number }[] = [];
    const moon: { frac: number; alt: number; y: number }[] = [];
    for (let i = 0; i <= SUN_PATH_SAMPLES; i++) {
      const frac = i / SUN_PATH_SAMPLES;
      const t = new Date(midnightMs + frac * dayMs);
      const sAlt = SunCalc.getPosition(t, useLat, useLon).altitude;
      const mAlt = SunCalc.getMoonPosition(t, useLat, useLon).altitude;
      sun.push({ frac, alt: sAlt, y: altToY(sAlt) });
      moon.push({ frac, alt: mAlt, y: altToY(mAlt) });
    }
    return { sun, moon };
  }, [midnightMs, dayMs, useLat, useLon, altToY]);

  // Generic helpers — convert a sample list into one or more SVG paths,
  // optionally filtering by above/below horizon and elapsed/future.
  const samplesToPath = (pts: { frac: number; y: number }[]): string =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.frac).toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const segmentBy = (
    pts: { frac: number; alt: number; y: number }[],
    keep: (s: { alt: number; frac: number }) => boolean,
  ): string[] => {
    const out: string[] = [];
    let buf: { frac: number; y: number }[] = [];
    for (const s of pts) {
      if (keep(s)) buf.push({ frac: s.frac, y: s.y });
      else if (buf.length > 1) { out.push(samplesToPath(buf)); buf = []; }
      else buf = [];
    }
    if (buf.length > 1) out.push(samplesToPath(buf));
    return out;
  };

  // Insert a synthetic point at every alt=0 crossing (horizon) so adjacent
  // segments (above/below) share the exact crossing point and connect without
  // a gap. The interpolated y lands exactly on horizonY.
  const withAltCrossings = (pts: { frac: number; alt: number; y: number }[]) => {
    const out: { frac: number; alt: number; y: number }[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      if (i > 0) {
        const prev = pts[i - 1]!;
        if ((prev.alt < 0) !== (p.alt < 0)) {
          const t = -prev.alt / (p.alt - prev.alt);
          out.push({ frac: prev.frac + t * (p.frac - prev.frac), alt: 0, y: horizonY });
        }
      }
      out.push(p);
    }
    return out;
  };

  // Insert a synthetic point at nowFrac so the elapsed/future split lands
  // exactly at the current-time marker with no gap between the two segments.
  const withNowCrossing = (pts: { frac: number; alt: number; y: number }[]) => {
    const out: { frac: number; alt: number; y: number }[] = [];
    let inserted = false;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      if (!inserted && i > 0 && pts[i - 1]!.frac < nowFrac && p.frac > nowFrac) {
        const prev = pts[i - 1]!;
        const t = (nowFrac - prev.frac) / (p.frac - prev.frac);
        out.push({ frac: nowFrac, alt: prev.alt + t * (p.alt - prev.alt), y: prev.y + t * (p.y - prev.y) });
        inserted = true;
      }
      out.push(p);
    }
    return out;
  };

  // Sun arc segments. "Elapsed" portions (frac ≤ nowFrac) get the bright
  // amber / slate treatment; future portions sit on the dashed background.
  // Dashes are drawn only for the future portion so the dotted path never
  // shows through the solid elapsed lines on top.
  // Inclusive boundary conditions (<=/>= on both sides of each crossing) ensure
  // adjacent segments share the synthetic crossing point so there's no gap.
  const sunPts = withNowCrossing(withAltCrossings(samples.sun));
  const sunFuturePaths = segmentBy(sunPts, s => s.frac >= nowFrac);
  const sunElapsedAbove = segmentBy(sunPts, s => s.frac <= nowFrac && s.alt >= 0);
  const sunElapsedBelow = segmentBy(sunPts, s => s.frac <= nowFrac && s.alt <= 0);

  // Moon: light up the whole above-horizon portion in blue (we don't track
  // elapsed/future for moon — the curve is short enough that it reads as a
  // single "moon-up" highlight). Dashes drawn only for below-horizon so they
  // don't show through the solid blue above-horizon arc.
  // Moon: same elapsed/future split as the sun.
  // Elapsed above-horizon → solid bright blue.
  // Elapsed below-horizon → solid dim blue.
  // Future (any altitude)  → dashed.
  const moonSamples = moonrise || moonset || moonPhase !== undefined ? samples.moon : null;
  const moonPts = moonSamples ? withNowCrossing(withAltCrossings(moonSamples)) : null;
  const moonFuturePaths  = moonPts ? segmentBy(moonPts, s => s.frac >= nowFrac) : [];
  const moonElapsedAbove = moonPts ? segmentBy(moonPts, s => s.frac <= nowFrac && s.alt >= 0) : [];
  const moonElapsedBelow = moonPts ? segmentBy(moonPts, s => s.frac <= nowFrac && s.alt <= 0) : [];

  // Current positions (uses suncalc directly rather than interpolating
  // samples — accurate to the second instead of the 15-min sample grid).
  const sunPos = SunCalc.getPosition(new Date(nowMs), useLat, useLon);
  const sunX = xOf(nowFrac);
  const sunY = altToY(sunPos.altitude);
  const isDay = sunPos.altitude >= 0;

  const moonPos = moonSamples ? SunCalc.getMoonPosition(new Date(nowMs), useLat, useLon) : null;
  const moonX = moonPos ? xOf(nowFrac) : 0;
  const moonY = moonPos ? altToY(moonPos.altitude) : 0;
  const isMoonUp = moonPos ? moonPos.altitude >= 0 : false;
  const moonGlyphR = isMoonUp ? 6 : 4;
  const showMoonGlyph = moonSamples !== null && moonPhase !== undefined;

  // Rise/set fractions: derived from SunCalc (same source as the arc samples)
  // so the ticks land exactly where the arc crosses the horizon line.
  // Using the API-provided sunrise/sunset times caused a visible offset because
  // the two algorithms disagree by a few minutes.
  const sunCalcTimes = React.useMemo(
    () => SunCalc.getTimes(new Date(midnightMs), useLat, useLon),
    [midnightMs, useLat, useLon],
  );
  const sunRiseFrac = (sunCalcTimes.sunrise.getTime() - midnightMs) / dayMs;
  const sunSetFrac  = (sunCalcTimes.sunset.getTime()  - midnightMs) / dayMs;
  const moonRiseRaw = moonrise ? (moonrise.getTime() - midnightMs) / dayMs : null;
  const moonSetRaw  = moonset  ? (moonset.getTime()  - midnightMs) / dayMs : null;
  const inWindow = (f: number | null): f is number => f !== null && f >= 0 && f <= 1;


  // Reuse the weather ramp so the celestial arcs feel like part of the same
  // temperature story: warm-to-hot colors for the sun, cool blue for moonlight.
  // The active named theme supplies brighter values in dark mode automatically.
  const SUN_COLOR = 'hsl(var(--weather-temp-warm))';
  const SUN_LOW = 'hsl(var(--weather-temp-hot))';
  const SUN_HORIZON = 'hsl(var(--weather-temp-very-hot))';
  const SUN_NIGHT = 'hsl(var(--weather-temp-cold))';
  const MOON_COLOR = 'hsl(var(--weather-temp-freezing))';
  const MOON_MUTED = 'hsl(var(--weather-temp-cold))';

  const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  // Pick a sun-dot color that matches where it sits on the altitude gradient
  // — red near the horizon, amber high in the sky. Bucketed (rather than
  // smoothly interpolated) for legibility against a small dot.
  const sunDotColor = isDay
    ? sunPos.altitude < 0.087 // ~5°
      ? SUN_HORIZON
      : sunPos.altitude < 0.314 // ~18°
        ? SUN_LOW
        : SUN_COLOR
    : SUN_NIGHT;

  return (
    <div ref={containerRef} className="flex flex-col gap-1 w-full">
      <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }}>
        {/* Altitude-based color gradient for the sun arc — red at the
            horizon, orange at low altitude, amber at zenith. Matches the
            atmospheric-scattering color shift you'd actually see in the sky. */}
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse"
            x1={0} y1={horizonY} x2={0} y2={horizonY - ryTop}>
            <stop offset="0" stopColor={SUN_HORIZON} />
            <stop offset="0.3" stopColor={SUN_LOW} />
            <stop offset="1" stopColor={SUN_COLOR} />
          </linearGradient>
          {/* Punches a hole in the moon arc around the phase glyph so the
              line stops at the disc's perimeter instead of crossing the
              unlit (unfilled) part of the moon. */}
          {showMoonGlyph && (
            <mask id={moonMaskId} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={H}>
              <rect x={0} y={0} width={width} height={H} fill="white" />
              {/* Hole radius = glyph radius + half its outline stroke, so the
                  arc is clipped exactly at the outline's outer edge. */}
              <circle cx={moonX} cy={moonY} r={moonGlyphR + 0.5} fill="black" />
            </mask>
          )}
        </defs>

        {/* Horizon line */}
        <line
          x1={pad - 4} y1={horizonY} x2={width - pad + 4} y2={horizonY}
          stroke="currentColor" strokeOpacity={0.12} strokeWidth={1}
        />

        {/* Sun: future arc — dashed amber */}
        {sunFuturePaths.map((d, i) => (
          <path key={`sun-future-${i}`} d={d} fill="none" stroke={SUN_COLOR}
            strokeOpacity={0.2} strokeWidth={2} strokeDasharray="2 4" />
        ))}

        {/* Sun: elapsed below-horizon — solid dim amber */}
        {sunElapsedBelow.map((d, i) => (
          <path key={`sun-down-${i}`} d={d} fill="none" stroke={SUN_COLOR}
            strokeOpacity={0.25} strokeWidth={2.5} strokeLinecap="round" />
        ))}

        {/* Sun: elapsed above-horizon — gradient by altitude (red→orange→amber) */}
        {sunElapsedAbove.map((d, i) => (
          <path key={`sun-up-${i}`} d={d} fill="none" stroke={`url(#${gradientId})`}
            strokeOpacity={0.85} strokeWidth={2.5} strokeLinecap="round" />
        ))}


        {/* Moon arc — masked so the line stops at the glyph's perimeter
            rather than running through the unlit part of the disc. */}
        <g mask={showMoonGlyph ? `url(#${moonMaskId})` : undefined}>
          {/* Moon arc: future portion — dashed */}
          {moonFuturePaths.map((d, i) => (
            <path key={`moon-future-${i}`} d={d} fill="none" stroke={MOON_COLOR}
              strokeOpacity={0.2} strokeWidth={2} strokeDasharray="2 4" />
          ))}
          {/* Moon arc: elapsed below-horizon — solid dim blue */}
          {moonElapsedBelow.map((d, i) => (
            <path key={`moon-below-${i}`} d={d} fill="none" stroke={MOON_COLOR}
              strokeOpacity={0.25} strokeWidth={2.5} strokeLinecap="round" />
          ))}
          {/* Moon arc: elapsed above-horizon — solid bright blue */}
          {moonElapsedAbove.map((d, i) => (
            <path key={`moon-up-${i}`} d={d} fill="none" stroke={MOON_COLOR}
              strokeOpacity={0.75} strokeWidth={2.5} strokeLinecap="round" />
          ))}
        </g>


        {/* Moon glyph at current position — blue when above, muted when below.
            Disc outline is drawn unfilled so a new moon (lit area collapses to
            zero) reads as an empty circle rather than a faint disc.
            Drawn before the sun so the sun sits on top when the two overlap
            (both ride the same now-X, so near-equal altitudes collide). */}
        {showMoonGlyph && (
          <g>
            {isMoonUp && <circle cx={moonX} cy={moonY} r={11} fill={MOON_COLOR} opacity={0.18} />}
            <circle cx={moonX} cy={moonY} r={moonGlyphR}
              fill="none"
              stroke={isMoonUp ? MOON_COLOR : MOON_MUTED}
              strokeOpacity={isMoonUp ? 0.65 : 0.4}
              strokeWidth={1} />
            <path d={moonPhasePath(moonX, moonY, moonGlyphR, moonPhase!)}
              fill={isMoonUp ? MOON_COLOR : MOON_MUTED}
              opacity={isMoonUp ? 1 : 0.55} />
          </g>
        )}

        {/* Sun glow + dot — color tracks altitude so a low sun glows red/orange */}
        {isDay && <circle cx={sunX} cy={sunY} r={16} fill={sunDotColor} opacity={0.2} />}
        <circle
          cx={sunX} cy={sunY}
          r={isDay ? 7 : 4}
          fill={sunDotColor}
          opacity={isDay ? 1 : 0.55}
        />
      </svg>

      {/* Sun / moon times — a compact evenly-spaced row keeps the sun pair on
          the left and moon pair on the right, with daylight duration retained
          between the sun times. */}
      <div className="flex items-center justify-between gap-3 text-[11px] tabular-nums pt-0.5 whitespace-nowrap">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1" style={{ color: SUN_COLOR }} title="Sunrise">
            <Sunrise className="h-3 w-3" />{fmtTime(sunrise)}
          </span>
          {inWindow(sunRiseFrac) && inWindow(sunSetFrac) && (() => {
            const dayMsSpan = sunset.getTime() - sunrise.getTime();
            const h = Math.floor(dayMsSpan / 3_600_000);
            const m = Math.round((dayMsSpan % 3_600_000) / 60_000);
            return <span className="font-medium opacity-80" style={{ color: SUN_COLOR }}>{h}h {m}m</span>;
          })()}
          <span className="flex items-center gap-1" style={{ color: SUN_COLOR }} title="Sunset">
            <Sunset className="h-3 w-3" />{fmtTime(sunset)}
          </span>
        </span>
        {(moonrise || moonset) && (
          <span className="flex items-center gap-3" style={{ color: MOON_COLOR }}>
            {moonrise && (
              <span className="flex items-center gap-1" title="Moonrise">
                <MoonGlyph phase={moonPhase ?? 0} size={11} /><span className="opacity-70">↑</span>{fmtTime(moonrise)}
              </span>
            )}
            {moonset && (
              <span className="flex items-center gap-1" title="Moonset">
                {!moonrise && <MoonGlyph phase={moonPhase ?? 0} size={11} />}<span className="opacity-70">↓</span>{fmtTime(moonset)}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}


/**
 * DEMO DATA
 * Realistic variety for development/testing.
 */
function getDemoWeatherData(location: string): WeatherData {
  const today = new Date();
  const dayNames = DAYS_SHORT_ARRAY;

  const conditions: WeatherCondition[] = [
    'partly-cloudy',
    'sunny',
    'cloudy',
    'rainy',
    'stormy',
    'snowy',
    'sunny',
  ];

  const highs   = [52, 61, 47, 44, 39, 34, 58];
  const lows    = [38, 45, 36, 31, 27, 22, 40];
  const precips = [78,  0,  0, 86, 97,  2, 20];

  const forecast: ForecastDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    return {
      date,
      dayName:          dayNames[date.getDay()] ?? 'Day',
      high:             highs[i] ?? 55,
      low:              lows[i] ?? 40,
      condition:        conditions[i] ?? 'sunny',
      precipProbability: precips[i] ?? 0,
    };
  });

  const sunrise = new Date(today);
  sunrise.setHours(6, 27, 0, 0);
  const sunset = new Date(today);
  sunset.setHours(19, 48, 0, 0);

  // Demo hourly data: 24 hours starting now
  const hourlyConditions: WeatherCondition[] = [
    'partly-cloudy', 'partly-cloudy', 'cloudy', 'rainy', 'rainy',
    'rainy', 'cloudy', 'cloudy', 'partly-cloudy', 'sunny',
    'sunny', 'sunny', 'partly-cloudy', 'cloudy', 'rainy',
    'rainy', 'cloudy', 'cloudy', 'partly-cloudy', 'partly-cloudy',
    'cloudy', 'cloudy', 'rainy', 'rainy',
  ];
  const hourlyTemps = [
    52, 51, 50, 49, 48, 47, 47, 48, 50, 53,
    55, 57, 57, 56, 54, 52, 51, 50, 49, 48,
    47, 47, 46, 46,
  ];
  const hourlyPrecips = [
    20, 25, 35, 65, 80, 75, 55, 40, 20, 5,
    0, 0, 10, 30, 70, 85, 60, 40, 25, 15,
    20, 30, 60, 75,
  ];
  const hourly: HourlyForecast[] = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(today);
    t.setMinutes(0, 0, 0);
    t.setHours(t.getHours() + i);
    return {
      time: t,
      condition: hourlyConditions[i] ?? 'cloudy',
      temp: hourlyTemps[i] ?? 50,
      feelsLike: (hourlyTemps[i] ?? 50) - 2,
      precipProbability: hourlyPrecips[i] ?? 0,
    };
  });

  // Demo minutely: trace → light rain starting ~20 min in, plateaus, matches screenshot
  const nowSec = Math.floor(Date.now() / 1000);
  const minutely: MinutelyData[] = Array.from({ length: 61 }, (_, i) => {
    let intensity = 0;
    if (i >= 16 && i < 22) {
      intensity = 2.5 * ((i - 16) / 6);   // ramp up to LIGHT
    } else if (i >= 22 && i <= 55) {
      intensity = 2.2 + 0.5 * Math.sin((i - 22) / 8); // plateau near LIGHT
    } else if (i > 55) {
      intensity = 2.5 * ((61 - i) / 6);   // taper off
    }
    return {
      time: nowSec + i * 60,
      // The demo curve is authored in mm/hr; keep the demo's imperial units
      // contract by converting it to inches before it enters WeatherData.
      precipIntensity: parseFloat((intensity / MILLIMETERS_PER_INCH).toFixed(4)),
      precipProbability: intensity > 0 ? 0.8 : 0,
    };
  });

  return {
    location:    location || 'Melrose, MA',
    units: { temperature: 'F', windSpeed: 'mph', precipitation: 'in' },
    current: {
      temperature: 52,
      feelsLike:   48,
      condition:   'partly-cloudy',
      humidity:    62,
      windSpeed:   9,
      uvIndex:     4.8,
      description: 'Partly cloudy',
    },
    forecast,
    hourly,
    minutely,
    sunrise,
    sunset,
    // Synthetic moon fixture: waning gibbous — easy to eyeball in dev.
    moonrise: (() => { const d = new Date(today); d.setHours(20, 14, 0, 0); return d; })(),
    moonset:  (() => { const d = new Date(today); d.setHours(8, 47, 0, 0); d.setDate(d.getDate() + 1); return d; })(),
    moonPhase: 0.62,
    moonIllumination: 0.78,
    moonPhaseName: 'Waning Gibbous',
    // Default to the same Chicago coords used by the server providers so
    // suncalc can plot real altitude curves in demo mode.
    lat: 41.8781,
    lon: -87.6298,
    lastUpdated: new Date(),
  };
}
