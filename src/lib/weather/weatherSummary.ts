import type { HourlyForecast, WeatherCondition } from '@/components/widgets/WeatherWidget';
import {
  buildForecastPeriods,
  FORECAST_PERIOD_DEFINITIONS,
  getLocationDateParts,
  type ForecastPeriod,
  type ForecastPeriodKey,
  type LocationTimeOptions,
} from './forecastPeriods';

export type WeatherSummaryTranslator = (
  key: string,
  values?: Record<string, string | number>
) => string;

export interface WeatherSummaryInput extends LocationTimeOptions {
  currentCondition: WeatherCondition;
  periods?: readonly ForecastPeriod[];
  hourly?: readonly HourlyForecast[];
  nowMs?: number;
}

const LEGACY_PERIOD_KEYS: Record<string, ForecastPeriodKey> = {
  morn: 'morning',
  morning: 'morning',
  aft: 'afternoon',
  afternoon: 'afternoon',
  eve: 'evening',
  evening: 'evening',
};

const SUMMARY_IMPACT: Record<WeatherCondition, number> = {
  sunny: 0,
  'partly-cloudy': 1,
  cloudy: 2,
  rainy: 3,
  snowy: 4,
  stormy: 5,
};

function capitalizeSentence(value: string): string {
  return value.length === 0 ? value : value[0]!.toLocaleUpperCase() + value.slice(1);
}

function periodKey(period: ForecastPeriod): ForecastPeriodKey | undefined {
  return period.period ?? LEGACY_PERIOD_KEYS[period.label.trim().toLowerCase()];
}

/**
 * Format a deterministic, localized summary with no more than two clauses.
 * Timed wording is used only when location-clock data and that day part exist.
 */
export function formatWeatherSummary(
  input: WeatherSummaryInput,
  translate: WeatherSummaryTranslator
): string {
  const nowMs = input.nowMs ?? Date.now();
  const locationOptions: LocationTimeOptions = {
    timeZone: input.timeZone,
    utcOffsetSeconds: input.utcOffsetSeconds,
  };
  const localNow = getLocationDateParts(nowMs, locationOptions);

  const byPeriod = new Map<ForecastPeriodKey, ForecastPeriod>();
  for (const period of input.periods ?? []) {
    if (localNow && period.dateKey && period.dateKey !== localNow.dateKey) continue;
    const key = periodKey(period);
    if (key && !byPeriod.has(key)) byPeriod.set(key, period);
  }

  if (localNow && input.hourly?.length) {
    const derived = buildForecastPeriods(input.hourly, locationOptions, nowMs);
    for (const period of derived) {
      if (period.period && !byPeriod.has(period.period)) byPeriod.set(period.period, period);
    }
  }

  const available = localNow
    ? FORECAST_PERIOD_DEFINITIONS.filter(
        (definition) => definition.maxHour > localNow.hour
      ).flatMap((definition) => {
        const period = byPeriod.get(definition.key);
        const isActive = definition.minHour <= localNow.hour && localNow.hour < definition.maxHour;
        return period
          ? [
              {
                period: definition.key,
                condition: isActive ? input.currentCondition : period.condition,
              },
            ]
          : [];
      })
    : [];

  const collapsed = available.reduce<
    Array<{
      period: ForecastPeriodKey;
      condition: WeatherCondition;
    }>
  >((clauses, clause) => {
    if (clauses.at(-1)?.condition !== clause.condition) clauses.push(clause);
    return clauses;
  }, []);

  const clauses =
    collapsed.length <= 2
      ? collapsed
      : [
          collapsed[0]!,
          collapsed
            .slice(1)
            .reduce((mostSalient, candidate) =>
              SUMMARY_IMPACT[candidate.condition] > SUMMARY_IMPACT[mostSalient.condition]
                ? candidate
                : mostSalient
            ),
        ];
  const condition = (value: WeatherCondition, period?: ForecastPeriodKey) => {
    const key = value === 'sunny' && period === 'evening' ? 'sunnyNight' : value;
    return translate(`summary.conditions.${key}`);
  };
  const timing = (value: ForecastPeriodKey) => translate(`summary.periods.${value}`);

  // The salience cap can select the same condition at both ends when a less
  // impactful middle-period change is omitted. That is not a transition, so
  // describe the shared condition across the whole day.
  if (clauses.length === 2 && clauses[0]!.condition === clauses[1]!.condition) {
    return capitalizeSentence(
      translate('summary.singleToday', {
        condition: condition(clauses[0]!.condition),
      })
    );
  }

  if (clauses.length === 0) {
    return capitalizeSentence(
      translate('summary.singleToday', {
        condition: condition(input.currentCondition),
      })
    );
  }

  if (clauses.length === 1) {
    const clause = clauses[0]!;
    const key = available.length > 1 ? 'summary.singleToday' : 'summary.singleTimed';
    return capitalizeSentence(
      translate(key, {
        condition: condition(clause.condition, clause.period),
        period: timing(clause.period),
      })
    );
  }

  return capitalizeSentence(
    translate('summary.transition', {
      first: condition(clauses[0]!.condition, clauses[0]!.period),
      firstPeriod: timing(clauses[0]!.period),
      second: condition(clauses[1]!.condition, clauses[1]!.period),
      secondPeriod: timing(clauses[1]!.period),
    })
  );
}
