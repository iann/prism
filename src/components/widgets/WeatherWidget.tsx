/**
 *
 * Displays current weather conditions, a multi-day forecast summary,
 * and a 24-hour hourly timeline.
 * Uses merry-timeline to render the next 24 hours as a color-coded strip.
 *
 * FEATURES:
 * - Current temperature and conditions
 * - "Feels like" temperature, humidity, wind
 * - Multi-day forecast summary (day name, hi/lo, icon)
 * - Next 24 Hours timeline at hourly resolution (merry-timeline)
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
import {
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  CloudSun,
  Wind,
  Droplets,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DAYS_SHORT_ARRAY } from '@/lib/constants/days';
import { WidgetContainer } from './WidgetContainer';

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

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  condition: WeatherCondition;
  humidity: number;
  windSpeed: number;
  description: string;
}

export interface ForecastDay {
  date: Date;
  dayName: string;
  high: number;
  low: number;
  condition: WeatherCondition;
}

/** One hour of forecast data for the 24-hour timeline. */
export interface HourlyForecast {
  time: Date;
  condition: WeatherCondition;
  temp: number; // °F
}

export interface ForecastPeriod {
  label: string;
  temp: number;
  condition: WeatherCondition;
}

export interface WeatherData {
  location: string;
  current: CurrentWeather;
  forecast: ForecastDay[];
  /** Next 24 hours of hourly forecast data for the timeline. */
  hourly?: HourlyForecast[];
  periods?: ForecastPeriod[];
  lastUpdated: Date;
}


/**
 * WEATHER WIDGET PROPS
 */
export interface WeatherWidgetProps {
  location?: string;
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
 * CONDITION → TIMELINE COLOR MAPPING
 */
const CONDITION_COLORS: Record<WeatherCondition, string> = {
  'sunny':         '#FBBF24',  // amber-400
  'partly-cloudy': '#7DD3FC',  // sky-300
  'cloudy':        '#94A3B8',  // slate-400
  'rainy':         '#60A5FA',  // blue-400
  'snowy':         '#BAE6FD',  // sky-200
  'stormy':        '#64748B',  // slate-500
};

const CONDITION_LABELS: Record<WeatherCondition, string> = {
  'sunny':         'Sunny',
  'partly-cloudy': 'Partly Cloudy',
  'cloudy':        'Cloudy',
  'rainy':         'Rainy',
  'snowy':         'Snowy',
  'stormy':        'Stormy',
};

/**
 * Build merry-timeline items from hourly forecast data.
 *
 * text = condition name so it appears on the colored stripe.
 * The library derives time ticks from the `time` field automatically.
 * Adjacent hours sharing the same condition merge into one labeled block,
 * matching the Dark Sky-style presentation.
 */
function buildHourlyTimelineItems(
  hourly: HourlyForecast[],
): Array<{ time: number; color: string; text: string }> {
  return hourly.slice(0, 24).map((h) => ({
    time:  Math.floor(h.time.getTime() / 1000),
    color: CONDITION_COLORS[h.condition],
    text:  CONDITION_LABELS[h.condition],
  }));
}

/**
 * Derive hourly forecast from daily data when no explicit hourly data is provided.
 * Assigns each hour the condition of its forecast day and uses a sine-curve
 * temperature that peaks around 2pm and bottoms out around 6am.
 */
function generateHourlyFromForecast(forecast: ForecastDay[]): HourlyForecast[] {
  if (forecast.length === 0) return [];

  const now = new Date();
  const startHour = new Date(now);
  startHour.setMinutes(0, 0, 0);

  return Array.from({ length: 24 }, (_, i) => {
    const time = new Date(startHour.getTime() + i * 3_600_000);

    // Match this hour to a forecast day by calendar date
    const timeDate = new Date(time);
    timeDate.setHours(0, 0, 0, 0);
    const day =
      forecast.find((d) => {
        const fd = new Date(d.date);
        fd.setHours(0, 0, 0, 0);
        return fd.getTime() === timeDate.getTime();
      }) ?? forecast[0]!;

    // Smooth temperature curve: low at 6am, peak at 2pm (hour 14)
    const h = time.getHours();
    const fraction = Math.max(0, Math.sin(((h - 6) / 16) * Math.PI));
    const temp = Math.round(day.low + (day.high - day.low) * fraction);

    return { time, condition: day.condition, temp };
  });
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

  const isVertical = gridH > gridW;

  // Clamp forecast days: default 5, max 7, min 1
  const resolvedDays = forecastDays ?? Math.min(5, Math.max(1, weatherData.forecast.length));

  // Resolve hourly data — use explicit field or derive from daily forecast
  const hourlyData: HourlyForecast[] =
    weatherData.hourly ?? generateHourlyFromForecast(weatherData.forecast);

  const hasDays   = weatherData.forecast.length > 0;
  const hasHourly = hourlyData.length > 0;

  return (
    <WidgetContainer
      title="Weather"
      icon={<Cloud className="h-4 w-4" />}
      size="medium"
      loading={loading}
      error={error}
      className={className}
    >
      <div className={cn('flex flex-col gap-3 h-full overflow-auto', isVertical ? 'pb-2' : '')}>

        {/* CURRENT CONDITIONS */}
        <CurrentConditions
          weather={weatherData.current}
          location={weatherData.location}
          useCelsius={useCelsius}
        />

        {/* FORECAST SECTION */}
        {showForecast && (hasDays || hasHourly) && (
          <div className="border-t border-border pt-3 flex-1 min-h-0 flex flex-col gap-3">

            {/* Multi-day summary */}
            {hasDays && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {resolvedDays}-Day Forecast
                </span>
                <DayHeader
                  days={weatherData.forecast.slice(0, resolvedDays)}
                  useCelsius={useCelsius}
                />
              </div>
            )}

            {/* 24-hour hourly timeline */}
            {hasHourly && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Next 24 Hours
                </span>
                <WeatherTimeline hourly={hourlyData} />
                <ConditionLegend hourly={hourlyData} />
              </div>
            )}

          </div>
        )}
      </div>
    </WidgetContainer>
  );
});


/**
 * CURRENT CONDITIONS SECTION
 */
function CurrentConditions({
  weather,
  location,
  useCelsius,
}: {
  weather: CurrentWeather;
  location: string;
  useCelsius: boolean;
}) {
  const temp  = formatTempDisplay(weather.temperature, useCelsius);
  const feels = formatTempDisplay(weather.feelsLike, useCelsius);

  return (
    <div className="flex items-start justify-between gap-2">
      {/* Left: icon + temp + description */}
      <div className="flex items-center gap-3">
        <WeatherIcon
          condition={weather.condition}
          className="h-10 w-10 text-primary flex-shrink-0"
        />
        <div>
          <div className="text-4xl font-bold leading-none">{temp}</div>
          <div className="text-sm text-muted-foreground capitalize mt-0.5">
            {weather.description}
          </div>
          {location && (
            <div className="text-xs text-muted-foreground/70 mt-0.5 truncate max-w-[140px]">
              {location}
            </div>
          )}
        </div>
      </div>

      {/* Right: stats */}
      <div className="text-right text-xs text-muted-foreground space-y-1 pt-0.5">
        <div className="text-sm">Feels like {feels}</div>
        <div className="flex items-center justify-end gap-1">
          <Droplets className="h-3 w-3" />
          <span>{weather.humidity}%</span>
        </div>
        <div className="flex items-center justify-end gap-1">
          <Wind className="h-3 w-3" />
          <span>{weather.windSpeed} mph</span>
        </div>
      </div>
    </div>
  );
}


/**
 * DAY HEADER
 * Equal-width columns showing day name, condition icon, and hi/lo temps.
 * Driven by the forecastDays prop — independent of the hourly timeline.
 */
function DayHeader({
  days,
  useCelsius,
}: {
  days: ForecastDay[];
  useCelsius: boolean;
}) {
  return (
    <div className="flex mt-2">
      {days.map((day, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-foreground">
            {day.dayName}
          </span>
          <div className="flex items-center gap-0.5">
            <WeatherIcon
              condition={day.condition}
              className="h-3 w-3 text-muted-foreground"
            />
            <span className="text-[10px] font-semibold">
              {useCelsius
                ? `${Math.round((day.high - 32) * 5 / 9)}°`
                : `${Math.round(day.high)}°`}
            </span>
            <span className="text-[10px] text-muted-foreground">
              /{useCelsius
                ? `${Math.round((day.low - 32) * 5 / 9)}°`
                : `${Math.round(day.low)}°`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}


/**
 * WEATHER TIMELINE
 * Renders the merry-timeline library for the next 24 hours of hourly data.
 * Each stripe = one hour, colored by condition, labeled with the time.
 */
// Cache the import promise so the module is only fetched once.
const timelineLibPromise =
  typeof window !== 'undefined' ? import('merry-timeline') : null;

function WeatherTimeline({ hourly }: { hourly: HourlyForecast[] }) {
  const timelineRef = React.useRef<HTMLDivElement>(null);

  const items = React.useMemo(
    () => buildHourlyTimelineItems(hourly),
    [hourly]
  );

  React.useEffect(() => {
    if (!timelineRef.current || items.length === 0 || !timelineLibPromise) return;
    const container = timelineRef.current;
    let cancelled = false;

    timelineLibPromise.then((mod) => {
      if (cancelled || !timelineRef.current) return;
      container.innerHTML = '';
      mod.default(container, items, {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    });

    return () => { cancelled = true; };
  }, [items]);

  return (
    <div
      ref={timelineRef}
      className={cn(
        'rounded-lg overflow-hidden w-full',
        'bg-slate-50 dark:bg-slate-700',
        '[&>*]:!max-w-full',
      )}
      style={{ minHeight: '64px' }}
      aria-label="Next 24 hours weather timeline"
    />
  );
}


/**
 * CONDITION LEGEND
 * Color swatches for each unique condition appearing in the hourly data.
 * Hidden when all 24 hours share the same condition.
 */
function ConditionLegend({ hourly }: { hourly: HourlyForecast[] }) {
  const unique = Array.from(new Set(hourly.map((h) => h.condition)));

  if (unique.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {unique.map((condition) => (
        <div key={condition} className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-sm flex-shrink-0"
            style={{ backgroundColor: CONDITION_COLORS[condition] }}
          />
          <span className="text-[10px] text-muted-foreground capitalize">
            {condition.replace('-', ' ')}
          </span>
        </div>
      ))}
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

  const highs = [52, 61, 47, 44, 39, 34, 58];
  const lows  = [38, 45, 36, 31, 27, 22, 40];

  const forecast: ForecastDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    return {
      date,
      dayName:   dayNames[date.getDay()] ?? 'Day',
      high:      highs[i] ?? 55,
      low:       lows[i] ?? 40,
      condition: conditions[i] ?? 'sunny',
    };
  });

  return {
    location:    location || 'Springfield, IL',
    current: {
      temperature: 52,
      feelsLike:   48,
      condition:   'partly-cloudy',
      humidity:    62,
      windSpeed:   9,
      description: 'Partly cloudy',
    },
    forecast,
    hourly: generateHourlyFromForecast(forecast),
    lastUpdated: new Date(),
  };
}
