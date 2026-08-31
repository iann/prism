import type { WeatherCondition } from '@/components/widgets/WeatherWidget';

export type ForecastPeriodKey = 'morning' | 'afternoon' | 'evening';

export interface ForecastPeriod {
  label: string;
  /** Stable key used for localized timing copy. Legacy cached data may omit it. */
  period?: ForecastPeriodKey;
  /** Location-local calendar date. Legacy cached data may omit it. */
  dateKey?: string;
  temp: number;
  condition: WeatherCondition;
  precipProbability?: number;
}

export interface ForecastPeriodSample {
  time: Date | string | number;
  temp: number;
  condition: WeatherCondition;
  precipProbability?: number;
}

export interface LocationTimeOptions {
  timeZone?: string;
  utcOffsetSeconds?: number;
}

export const FORECAST_PERIOD_DEFINITIONS: ReadonlyArray<{
  key: ForecastPeriodKey;
  label: string;
  minHour: number;
  maxHour: number;
}> = [
  { key: 'morning', label: 'Morn', minHour: 6, maxHour: 12 },
  { key: 'afternoon', label: 'Aft', minHour: 12, maxHour: 18 },
  { key: 'evening', label: 'Eve', minHour: 18, maxHour: 24 },
];

export interface LocationDateParts {
  dateKey: string;
  hour: number;
}

function toDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Read calendar date/hour at the forecast location without using runtime TZ. */
export function getLocationDateParts(
  value: Date | string | number,
  options: LocationTimeOptions
): LocationDateParts | null {
  const date = toDate(value);
  if (!date) return null;

  if (options.timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: options.timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(date);
      const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((candidate) => candidate.type === type)?.value;
      const year = part('year');
      const month = part('month');
      const day = part('day');
      const hour = Number(part('hour'));
      if (year && month && day && Number.isInteger(hour)) {
        return { dateKey: `${year}-${month}-${day}`, hour };
      }
    } catch {
      // Fall through to a provider-supplied fixed UTC offset when available.
    }
  }

  const utcOffsetSeconds = options.utcOffsetSeconds;
  if (typeof utcOffsetSeconds === 'number' && Number.isFinite(utcOffsetSeconds)) {
    const shifted = new Date(date.getTime() + utcOffsetSeconds * 1000);
    return {
      dateKey: `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`,
      hour: shifted.getUTCHours(),
    };
  }

  return null;
}

function representativeCondition(samples: readonly ForecastPeriodSample[]): WeatherCondition {
  const impactOrder: Record<WeatherCondition, number> = {
    sunny: 0,
    'partly-cloudy': 1,
    cloudy: 2,
    rainy: 3,
    snowy: 4,
    stormy: 5,
  };
  const counts = new Map<WeatherCondition, number>();
  for (const sample of samples) {
    counts.set(sample.condition, (counts.get(sample.condition) ?? 0) + 1);
  }

  // A short-lived impactful condition should not disappear behind a dry-sky
  // mode. Probability alone is not enough to infer a condition, so only the
  // provider's normalized condition categories participate here.
  for (const condition of ['stormy', 'snowy', 'rainy'] as const) {
    if (counts.has(condition)) return condition;
  }

  return [...counts.entries()].sort(
    ([conditionA, countA], [conditionB, countB]) =>
      countB - countA || impactOrder[conditionB] - impactOrder[conditionA]
  )[0]![0];
}

/** Build all available local-day parts from the provider's full hourly set. */
export function buildForecastPeriods(
  samples: readonly ForecastPeriodSample[],
  options: LocationTimeOptions,
  nowMs = Date.now()
): ForecastPeriod[] {
  const today = getLocationDateParts(nowMs, options);
  if (!today) return [];

  return FORECAST_PERIOD_DEFINITIONS.flatMap((definition) => {
    const matching = samples.filter((sample) => {
      const local = getLocationDateParts(sample.time, options);
      return (
        local?.dateKey === today.dateKey &&
        local.hour >= definition.minHour &&
        local.hour < definition.maxHour
      );
    });
    if (matching.length === 0) return [];

    const isActive = today.hour >= definition.minHour && today.hour < definition.maxHour;
    const remaining = isActive
      ? matching.filter((sample) => {
          const date = toDate(sample.time);
          return date !== null && date.getTime() >= nowMs;
        })
      : matching;
    const representativeSamples = remaining.length > 0 ? remaining : matching;

    const averageTemperature =
      representativeSamples.reduce((sum, sample) => sum + sample.temp, 0) /
      representativeSamples.length;
    const precipProbabilities = representativeSamples
      .map((sample) => sample.precipProbability)
      .filter((value): value is number => value !== undefined && Number.isFinite(value));

    return [
      {
        label: definition.label,
        period: definition.key,
        dateKey: today.dateKey,
        temp: Math.round(averageTemperature),
        condition: representativeCondition(representativeSamples),
        precipProbability:
          precipProbabilities.length > 0 ? Math.round(Math.max(...precipProbabilities)) : undefined,
      },
    ];
  });
}
