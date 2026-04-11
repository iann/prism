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
  precipProbability?: number; // 0–100
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
  sunrise?: Date;
  sunset?: Date;
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

            {/* Sunrise / sunset arc */}
            {weatherData.sunrise && weatherData.sunset && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sun
                </span>
                <SunriseSunsetArc sunrise={weatherData.sunrise} sunset={weatherData.sunset} />
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
 * Dark Sky-style row list: day name + precip %, icon, lo | range bar | hi.
 * The bar track spans the full week's min–max range so each day's segment
 * is positioned proportionally.
 */
function DayHeader({
  days,
  useCelsius,
}: {
  days: ForecastDay[];
  useCelsius: boolean;
}) {
  const globalMin = Math.min(...days.map((d) => d.low));
  const globalMax = Math.max(...days.map((d) => d.high));
  const span = globalMax - globalMin || 1;

  const todayUTCDate = new Date().toISOString().split('T')[0]!;

  const fmt = (f: number) =>
    useCelsius ? Math.round((f - 32) * 5 / 9) : Math.round(f);

  return (
    <div className="flex flex-col mt-1">
      {days.map((day, i) => {
        // Compare UTC dates — server groups by UTC date (matching OWM's UTC data),
        // so isToday must also use UTC to avoid timezone-shift duplicates/gaps.
        const dayUTCDate = new Date(day.date).toISOString().split('T')[0]!;
        const isToday = dayUTCDate === todayUTCDate;
        const label = isToday ? 'TODAY' : day.dayName.toUpperCase();

        const leftPct  = ((day.low  - globalMin) / span) * 100;
        const widthPct = ((day.high - day.low)   / span) * 100;
        const rightPct = ((day.high - globalMin)  / span) * 100;

        return (
          <div key={i} className="flex items-center gap-2 py-1">

            {/* Day label + precip % + icon — all one left cell */}
            <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
              <div className="w-12 flex-shrink-0 h-8 flex flex-col justify-center">
                <div className="text-[11px] font-bold tracking-wide text-foreground leading-tight whitespace-nowrap">
                  {label}
                </div>
                {day.precipProbability !== undefined && (
                  <div className="flex items-center gap-0.5 text-[10px] text-blue-500 leading-tight">
                    <Droplets className="h-2.5 w-2.5 flex-shrink-0" />
                    <span>{day.precipProbability}%</span>
                  </div>
                )}
              </div>
              <WeatherIcon
                condition={day.condition}
                className="h-5 w-5 flex-shrink-0 text-muted-foreground"
              />
            </div>

            {/* Track: proportional flex spacers keep temps outside the pill, no overflow */}
            <div className="flex-1 flex items-center min-w-0">
              <div style={{ flex: leftPct }} />
              <span className="flex-none text-[11px] text-muted-foreground tabular-nums pr-1">
                {fmt(day.low)}°
              </span>
              <div
                className="h-4 rounded-full"
                style={{
                  flex: Math.max(widthPct, 4),
                  background: `linear-gradient(to right, ${tempToColor(day.low)}, ${tempToColor(day.high)})`,
                }}
              />
              <span className="flex-none text-[11px] font-semibold tabular-nums pl-1">
                {fmt(day.high)}°
              </span>
              <div style={{ flex: Math.max(100 - rightPct, 0) }} />
            </div>
          </div>
        );
      })}
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
 * SUNRISE / SUNSET ARC
 * Full 24-hour timeline: right edge = 12 AM (midnight), left edge = next 12 AM.
 * The single arc rises above the horizon between sunrise and sunset, and dips
 * below at night. The sun/moon dot moves right-to-left as the day progresses,
 * resetting to the right edge at midnight.
 */
function SunriseSunsetArc({ sunrise, sunset }: { sunrise: Date; sunset: Date }) {
  const [width, setWidth] = React.useState(220);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nowMs  = Date.now();
  const riseMs = sunrise.getTime();
  const setMs  = sunset.getTime();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const midnightMs = today.getTime();

  const dayMs   = setMs - riseMs;
  const nightMs = 24 * 3_600_000 - dayMs;
  const isDay   = nowMs >= riseMs && nowMs <= setMs;

  const H        = 110;
  const horizonY = 66;
  const pad      = 8;
  const arcWidth = width - 2 * pad;
  const ryTop    = horizonY - 10;      // peak height above horizon during day
  const ryBot    = H - horizonY - 10;  // depth below horizon during night

  // Y for any absolute timestamp — sinusoidal within each day/night half
  const getY = (tAbs: number): number => {
    if (tAbs >= riseMs && tAbs <= setMs) {
      return horizonY - ryTop * Math.sin(Math.PI * (tAbs - riseMs) / dayMs);
    } else if (tAbs > setMs) {
      return horizonY + ryBot * Math.sin(Math.PI * (tAbs - setMs) / nightMs);
    } else {
      // Before sunrise: late-night phase (fraction from previous sunset)
      return horizonY + ryBot * Math.sin(Math.PI * (1 - (riseMs - tAbs) / nightMs));
    }
  };

  // X: frac=0 (midnight) → left edge; frac=1 (next midnight) → right edge
  const xOf = (frac: number) => pad + frac * arcWidth;

  const nowFrac  = Math.max(0, Math.min(1, (nowMs - midnightMs) / 86_400_000));
  const riseFrac = (riseMs - midnightMs) / 86_400_000;
  const setFrac  = (setMs  - midnightMs) / 86_400_000;

  const sunX  = xOf(nowFrac);
  const sunY  = getY(nowMs);
  const riseX = xOf(riseFrac);
  const setX  = xOf(setFrac);

  // Build an SVG polyline path between two time fractions
  const buildPath = (fromFrac: number, toFrac: number, steps: number): string => {
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const f = fromFrac + (i / steps) * (toFrac - fromFrac);
      pts.push(`${i === 0 ? 'M' : 'L'} ${xOf(f).toFixed(1)} ${getY(midnightMs + f * 86_400_000).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const fullPath = buildPath(0, 1, 96);

  // Elapsed arcs — scoped to avoid amber appearing on the wrong side of the horizon.
  // Daytime:       amber from sunrise → now (in progress).
  // After sunset:  amber from sunrise → sunset (completed day) + gray from sunset → now.
  // Before sunrise: gray from midnight → now (still in overnight).
  let elapsedDayPath: string | null = null;
  let elapsedNightPath: string | null = null;  // post-sunset night portion
  let elapsedPreDawnPath: string | null = null; // midnight → sunrise portion

  if (isDay) {
    if (nowFrac > riseFrac + 0.002) {
      elapsedDayPath = buildPath(riseFrac, nowFrac, Math.max(4, Math.round(96 * (nowFrac - riseFrac))));
    }
  } else if (nowMs > setMs) {
    // Full day completed: pre-dawn night + full day arc + post-sunset night so far
    elapsedPreDawnPath = buildPath(0, riseFrac, Math.max(4, Math.round(96 * riseFrac)));
    elapsedDayPath     = buildPath(riseFrac, setFrac, Math.max(8, Math.round(96 * (setFrac - riseFrac))));
    if (nowFrac > setFrac + 0.002) {
      elapsedNightPath = buildPath(setFrac, nowFrac, Math.max(4, Math.round(96 * (nowFrac - setFrac))));
    }
  } else {
    if (nowFrac > 0.01) {
      elapsedNightPath = buildPath(0, nowFrac, Math.max(4, Math.round(96 * nowFrac)));
    }
  }

  const fmt  = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dayH = Math.floor(dayMs / 3_600_000);
  const dayM = Math.round((dayMs % 3_600_000) / 60_000);

  return (
    <div ref={containerRef} className="flex flex-col gap-1 w-full">
      <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }}>
        {/* Horizon line */}
        <line
          x1={pad - 4} y1={horizonY} x2={width - pad + 4} y2={horizonY}
          stroke="currentColor" strokeOpacity={0.12} strokeWidth={1}
        />

        {/* Sunrise / sunset tick marks */}
        <line x1={riseX} y1={horizonY - 5} x2={riseX} y2={horizonY + 5}
          stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.5} />
        <line x1={setX}  y1={horizonY - 5} x2={setX}  y2={horizonY + 5}
          stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.5} />

        {/* Full 24-hour arc — dashed */}
        <path
          d={fullPath}
          fill="none" stroke="currentColor"
          strokeOpacity={0.2} strokeWidth={2} strokeDasharray="4 3"
        />

        {/* Elapsed daytime arc — amber */}
        {elapsedDayPath && (
          <path
            d={elapsedDayPath}
            fill="none" stroke="#FBBF24"
            strokeOpacity={0.7} strokeWidth={2.5} strokeLinecap="round"
          />
        )}

        {/* Elapsed pre-dawn arc — muted (midnight → sunrise) */}
        {elapsedPreDawnPath && (
          <path
            d={elapsedPreDawnPath}
            fill="none" stroke="#94A3B8"
            strokeOpacity={0.45} strokeWidth={2.5} strokeLinecap="round"
          />
        )}

        {/* Elapsed post-sunset arc — muted (sunset → now) */}
        {elapsedNightPath && (
          <path
            d={elapsedNightPath}
            fill="none" stroke="#94A3B8"
            strokeOpacity={0.45} strokeWidth={2.5} strokeLinecap="round"
          />
        )}

        {/* Sun glow */}
        {isDay && <circle cx={sunX} cy={sunY} r={16} fill="#FBBF24" opacity={0.2} />}

        {/* Sun / moon dot */}
        <circle
          cx={sunX} cy={sunY}
          r={isDay ? 7 : 5}
          fill={isDay ? '#FBBF24' : '#94A3B8'}
          opacity={isDay ? 1 : 0.65}
        />
      </svg>

      {/* Labels: sunrise/sunset at their x positions, daylight duration between */}
      <div className="relative h-4 text-[11px] text-muted-foreground/70 select-none">
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: riseX }}>
          {fmt(sunrise)}
        </span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap opacity-60" style={{ left: (riseX + setX) / 2 }}>
          {dayH}h {dayM}m
        </span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: setX }}>
          {fmt(sunset)}
        </span>
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

  return {
    location:    location || 'Melrose, MA',
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
    sunrise,
    sunset,
    lastUpdated: new Date(),
  };
}
