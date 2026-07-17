'use client';

/**
 * Proportional flex-spacer forecast bar layout.
 *
 * Personal fork customization — replaces the upstream "unified pill track"
 * (sandydargoport/prism@5cfa21c) with a layout where the low and high
 * temperature labels sit directly adjacent to the coloured bar at its
 * proportional position on the track.
 *
 * Kept in a separate file so upstream merges to WeatherWidget.tsx don't
 * conflict with this preference. If upstream changes DayHeader, update the
 * import in WeatherWidget.tsx to point back here rather than inlining.
 */

import * as React from 'react';
import SunCalc from 'suncalc';
import { Droplets } from 'lucide-react';
import type { ForecastDay, WeatherUnits, WeatherCondition } from './WeatherWidget';

// ---------------------------------------------------------------------------
// Helpers (duplicated from WeatherWidget.tsx to keep this file self-contained)
// ---------------------------------------------------------------------------

const TEMP_COLOR_STOPS: Array<{ temp: number; rgb: [number, number, number] }> = [
  { temp:  0, rgb: [134, 165, 192] },
  { temp: 32, rgb: [128, 168, 188] },
  { temp: 45, rgb: [127, 184, 185] },
  { temp: 55, rgb: [151, 188, 158] },
  { temp: 65, rgb: [212, 193, 132] },
  { temp: 75, rgb: [220, 171, 103] },
  { temp: 85, rgb: [218, 139,  85] },
  { temp: 95, rgb: [196,  97,  80] },
];

function tempToColor(fahrenheit: number): string {
  const stops = TEMP_COLOR_STOPS;
  if (fahrenheit <= stops[0]!.temp) { const [r, g, b] = stops[0]!.rgb; return `rgb(${r},${g},${b})`; }
  if (fahrenheit >= stops[stops.length - 1]!.temp) { const [r, g, b] = stops[stops.length - 1]!.rgb; return `rgb(${r},${g},${b})`; }
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (fahrenheit >= a.temp && fahrenheit <= b.temp) {
      const t = (fahrenheit - a.temp) / (b.temp - a.temp);
      return `rgb(${Math.round(a.rgb[0] + t * (b.rgb[0] - a.rgb[0]))},${Math.round(a.rgb[1] + t * (b.rgb[1] - a.rgb[1]))},${Math.round(a.rgb[2] + t * (b.rgb[2] - a.rgb[2]))})`;
    }
  }
  const [r, g, b] = stops[stops.length - 1]!.rgb;
  return `rgb(${r},${g},${b})`;
}

function toFahrenheitForColor(value: number, units: WeatherUnits): number {
  return units.temperature === 'C' ? value * 9 / 5 + 32 : value;
}

// ---------------------------------------------------------------------------
// WeatherIcon (minimal copy — only the icons used in forecast rows)
// ---------------------------------------------------------------------------

import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, Zap } from 'lucide-react';

function WeatherIcon({ condition, className }: { condition: WeatherCondition; className?: string }) {
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

// ---------------------------------------------------------------------------
// MoonGlyph
// ---------------------------------------------------------------------------

function moonPhasePath(cx: number, cy: number, r: number, phase: number): string {
  const ph = ((phase % 1) + 1) % 1;
  const rxAbs = Math.abs(Math.cos(2 * Math.PI * ph)) * r;
  const outerSweep = ph < 0.5 ? 1 : 0;
  const innerSweep = Math.floor(ph * 4) % 2 === 1 ? 1 : 0;
  return `M ${cx},${cy - r} A ${r},${r} 0 0 ${outerSweep} ${cx},${cy + r} A ${rxAbs},${r} 0 0 ${innerSweep} ${cx},${cy - r} Z`;
}

function MoonGlyph({ phase, size = 14, color = 'currentColor' }: { phase: number; size?: number; color?: string }) {
  const r = size / 2 - 0.5;
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeOpacity={0.5} strokeWidth={0.8} />
      <path d={moonPhasePath(c, c, r, phase)} fill={color} opacity={0.9} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// DayHeader — the exported component
// ---------------------------------------------------------------------------

export function DayHeader({ days, units }: { days: ForecastDay[]; units: WeatherUnits }) {
  const now = new Date();
  const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const globalMin = Math.min(...days.map((d) => d.low));
  const globalMax = Math.max(...days.map((d) => d.high));
  const span = globalMax - globalMin || 1;

  const fmt = (v: number) => Math.round(v);
  const colorFor = (v: number) => tempToColor(toFahrenheitForColor(v, units));

  return (
    <div className="flex flex-col mt-1">
      {days.map((day, i) => {
        const d = new Date(day.date);
        const dayLocalStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        const isToday = dayLocalStr === todayLocalStr;
        const label = isToday ? 'TODAY' : day.dayName.toUpperCase();

        const leftPct  = ((day.low  - globalMin) / span) * 100;
        const widthPct = ((day.high - day.low)   / span) * 100;
        const rightPct = ((day.high - globalMin)  / span) * 100;

        const dayNoon = new Date(day.date);
        dayNoon.setHours(12, 0, 0, 0);
        const dayPhase = SunCalc.getMoonIllumination(dayNoon).phase;

        return (
          <div key={i} className="flex items-center gap-2 py-1">

            {/* Day label + precip % + weather icon + moon phase glyph */}
            <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
              <div className="w-12 flex-shrink-0 h-8 flex flex-col justify-center">
                <div className="text-[11px] font-bold tracking-wide text-foreground leading-tight whitespace-nowrap">
                  {label}
                </div>
                {day.precipProbability !== undefined && (
                  <div className="flex items-center gap-0.5 text-[10px] text-primary leading-tight">
                    <Droplets className="h-2.5 w-2.5 flex-shrink-0" />
                    <span>{day.precipProbability}%</span>
                  </div>
                )}
              </div>
              <WeatherIcon condition={day.condition} className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              <span className="text-primary/70">
                <MoonGlyph phase={dayPhase} size={14} />
              </span>
            </div>

            {/* Proportional flex-spacer track: low and high labels sit directly
                adjacent to the bar at its position within the week's range. */}
            <div className="flex-1 flex items-center min-w-0">
              <div style={{ flex: leftPct }} />
              <span className="flex-none text-[11px] text-muted-foreground tabular-nums pr-1">
                {fmt(day.low)}°
              </span>
              <div
                className="h-2.5 rounded-full opacity-80 ring-1 ring-inset ring-foreground/5"
                style={{
                  flex: Math.max(widthPct, 4),
                  background: `linear-gradient(to right, ${colorFor(day.low)}, ${colorFor(day.high)})`,
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
