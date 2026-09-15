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
  /** Unit of the forecast wind values; omitted legacy data is treated as mph. */
  windSpeedUnit?: 'mph' | 'km/h';
  /** Unit of the forecast temperature values; omitted legacy data is treated as Fahrenheit. */
  temperatureUnit?: 'F' | 'C';
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

const BREEZY_WIND_SPEED_MPH = 15;
const BREEZY_WIND_GUST_MPH = 25;
const BREEZY_WIND_SPEED_KMH = 24;
const BREEZY_WIND_GUST_KMH = 40;
const GUSTY_WIND_GUST_MPH = 30;
const GUSTY_WIND_GUST_KMH = 48;
const BLUSTERY_WIND_SPEED_MPH = 25;
const BLUSTERY_WIND_SPEED_KMH = 40;
const BLUSTERY_WIND_GUST_MPH = 35;
const BLUSTERY_WIND_GUST_KMH = 56;
const GUSTY_MIN_GAP_MPH = 10;
const GUSTY_MIN_GAP_KMH = 16;

const FREEZING_TEMPERATURE_F = 32;
const FREEZING_TEMPERATURE_C = 0;
const COLD_TEMPERATURE_F = 45;
const COLD_TEMPERATURE_C = 7;
const CRISP_TEMPERATURE_F = 55;
const CRISP_TEMPERATURE_C = 13;
const WARM_TEMPERATURE_F = 75;
const WARM_TEMPERATURE_C = 24;
const HOT_TEMPERATURE_F = 85;
const HOT_TEMPERATURE_C = 29;

type WindDescriptor = 'breezy' | 'gusty' | 'blustery';
type TemperatureDescriptor = 'freezing' | 'cold' | 'crisp' | 'warm' | 'hot';

const WIND_IMPACT: Record<WindDescriptor, number> = {
  breezy: 0.5,
  gusty: 0.75,
  blustery: 1,
};

const TEMPERATURE_IMPACT: Record<TemperatureDescriptor, number> = {
  freezing: 0.8,
  cold: 0.5,
  crisp: 0.25,
  warm: 0.3,
  hot: 0.8,
};

const CONDITION_VARIANTS: Record<WeatherCondition, readonly string[]> = {
  sunny: ['sunny', 'sunnyBright', 'sunnySunlit'],
  'partly-cloudy': ['partly-cloudy', 'partlyCloudyBright', 'partlyCloudySunClouds'],
  cloudy: ['cloudy', 'cloudyGray', 'cloudyOvercast'],
  rainy: ['rainy', 'rainyShowers', 'rainySteady'],
  snowy: ['snowy', 'snowyWintry', 'snowyShowers'],
  stormy: ['stormy', 'stormyThunderstorms', 'stormySkies'],
};

interface SummaryClause {
  period: ForecastPeriodKey;
  condition: WeatherCondition;
  precipProbability?: number;
  wind?: WindDescriptor;
  temperature?: TemperatureDescriptor;
}

function capitalizeSentence(value: string): string {
  return value.length === 0 ? value : value[0]!.toLocaleUpperCase() + value.slice(1);
}

function periodKey(period: ForecastPeriod): ForecastPeriodKey | undefined {
  return period.period ?? LEGACY_PERIOD_KEYS[period.label.trim().toLowerCase()];
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function pickStable<T>(values: readonly T[], seed: string): T {
  return values[stableHash(seed) % values.length]!;
}

function windDescriptor(
  period: Pick<ForecastPeriod, 'windSpeed' | 'windGust'>,
  windSpeedUnit: 'mph' | 'km/h' = 'mph'
): WindDescriptor | undefined {
  const speedThreshold = windSpeedUnit === 'km/h' ? BREEZY_WIND_SPEED_KMH : BREEZY_WIND_SPEED_MPH;
  const gustThreshold = windSpeedUnit === 'km/h' ? BREEZY_WIND_GUST_KMH : BREEZY_WIND_GUST_MPH;
  const gustyGustThreshold = windSpeedUnit === 'km/h' ? GUSTY_WIND_GUST_KMH : GUSTY_WIND_GUST_MPH;
  const blusterySpeedThreshold =
    windSpeedUnit === 'km/h' ? BLUSTERY_WIND_SPEED_KMH : BLUSTERY_WIND_SPEED_MPH;
  const blusteryGustThreshold =
    windSpeedUnit === 'km/h' ? BLUSTERY_WIND_GUST_KMH : BLUSTERY_WIND_GUST_MPH;
  const gustyMinGap = windSpeedUnit === 'km/h' ? GUSTY_MIN_GAP_KMH : GUSTY_MIN_GAP_MPH;
  const speed = period.windSpeed;
  const gust = period.windGust;

  if (
    (speed !== undefined && speed >= blusterySpeedThreshold) ||
    (gust !== undefined && gust >= blusteryGustThreshold)
  ) {
    return 'blustery';
  }
  if (
    gust !== undefined &&
    gust >= gustyGustThreshold &&
    (speed === undefined || gust - speed >= gustyMinGap)
  ) {
    return 'gusty';
  }
  if (
    (speed !== undefined && speed >= speedThreshold) ||
    (gust !== undefined && gust >= gustThreshold)
  ) {
    return 'breezy';
  }
  return undefined;
}

function temperatureDescriptor(
  temperature: number,
  temperatureUnit: 'F' | 'C' = 'F'
): TemperatureDescriptor | undefined {
  if (!Number.isFinite(temperature)) return undefined;

  const thresholds =
    temperatureUnit === 'C'
      ? {
          freezing: FREEZING_TEMPERATURE_C,
          cold: COLD_TEMPERATURE_C,
          crisp: CRISP_TEMPERATURE_C,
          warm: WARM_TEMPERATURE_C,
          hot: HOT_TEMPERATURE_C,
        }
      : {
          freezing: FREEZING_TEMPERATURE_F,
          cold: COLD_TEMPERATURE_F,
          crisp: CRISP_TEMPERATURE_F,
          warm: WARM_TEMPERATURE_F,
          hot: HOT_TEMPERATURE_F,
        };

  if (temperature <= thresholds.freezing) return 'freezing';
  if (temperature <= thresholds.cold) return 'cold';
  if (temperature <= thresholds.crisp) return 'crisp';
  if (temperature >= thresholds.hot) return 'hot';
  if (temperature >= thresholds.warm) return 'warm';
  return undefined;
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
      if (!period.period) continue;

      const existing = byPeriod.get(period.period);
      if (!existing) {
        byPeriod.set(period.period, period);
      } else if (
        (existing.windSpeed === undefined && period.windSpeed !== undefined) ||
        (existing.windGust === undefined && period.windGust !== undefined)
      ) {
        // Preserve provider-authored condition data while filling in wind for
        // older cached period objects that predate forecast wind fields.
        byPeriod.set(period.period, {
          ...existing,
          windSpeed: existing.windSpeed ?? period.windSpeed,
          windGust: existing.windGust ?? period.windGust,
        });
      }
    }
  }

  const windSpeedUnit = input.windSpeedUnit ?? 'mph';
  const temperatureUnit = input.temperatureUnit ?? 'F';
  const dateKey = localNow?.dateKey;
  const available = localNow
    ? FORECAST_PERIOD_DEFINITIONS.filter(
        (definition) => definition.maxHour > localNow.hour
      ).flatMap((definition) => {
        const period = byPeriod.get(definition.key);
        const isActive = definition.minHour <= localNow.hour && localNow.hour < definition.maxHour;
        const summaryCondition = isActive ? input.currentCondition : period?.condition;
        return period
          ? [
              {
                period: definition.key,
                condition: summaryCondition!,
                precipProbability: period.precipProbability,
                wind: windDescriptor(period, windSpeedUnit),
                temperature:
                  summaryCondition === 'sunny' ||
                  summaryCondition === 'partly-cloudy' ||
                  summaryCondition === 'cloudy'
                    ? temperatureDescriptor(period.temp, temperatureUnit)
                    : undefined,
              },
            ]
          : [];
      })
    : [];

  const collapsed = available.reduce<SummaryClause[]>((clauses, clause) => {
    const previous = clauses.at(-1);
    if (
      previous?.condition !== clause.condition ||
      previous.wind !== clause.wind ||
      previous.temperature !== clause.temperature
    ) {
      clauses.push(clause);
    }
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
              SUMMARY_IMPACT[candidate.condition] +
                (candidate.wind ? WIND_IMPACT[candidate.wind] : 0) +
                (candidate.temperature ? TEMPERATURE_IMPACT[candidate.temperature] : 0) >
              SUMMARY_IMPACT[mostSalient.condition] +
                (mostSalient.wind ? WIND_IMPACT[mostSalient.wind] : 0) +
                (mostSalient.temperature ? TEMPERATURE_IMPACT[mostSalient.temperature] : 0)
                ? candidate
                : mostSalient
            ),
        ];
  const condition = (
    value: WeatherCondition,
    period?: ForecastPeriodKey,
    precipProbability?: number
  ) => {
    const key = value === 'sunny' && period === 'evening' ? 'sunnyNight' : value;
    if (!dateKey) return translate(`summary.conditions.${key}`);

    const variants =
      key === 'sunnyNight'
        ? ['sunnyNight', 'sunnyNightClear']
        : (value === 'rainy' || value === 'snowy') && precipProbability === undefined
          ? [value]
          : CONDITION_VARIANTS[value];
    const variantKey = pickStable(variants, `${dateKey}:${period ?? 'day'}:${value}`);
    return translate(`summary.conditions.${variantKey}`);
  };
  const describeCondition = (
    value: WeatherCondition,
    period: ForecastPeriodKey | undefined,
    precipProbability: number | undefined,
    wind: WindDescriptor | undefined,
    temperature: TemperatureDescriptor | undefined
  ) => {
    const description = condition(value, period, precipProbability);
    if (
      !wind &&
      temperature &&
      (value === 'sunny' || value === 'partly-cloudy' || value === 'cloudy')
    ) {
      return translate('summary.conditions.withTemperature', {
        condition: description,
        temperature: translate(`summary.temperature.${temperature}`),
      });
    }
    if (!wind) return description;

    const windText = translate(`summary.wind.${wind}`);
    return wind === 'breezy'
      ? translate('summary.conditions.withBreezy', { condition: description })
      : translate('summary.conditions.withWind', { condition: description, wind: windText });
  };
  const timing = (value: ForecastPeriodKey) => translate(`summary.periods.${value}`);

  // The salience cap can select the same condition at both ends when a less
  // impactful middle-period change is omitted. That is not a transition, so
  // describe the shared condition across the whole day.
  if (
    clauses.length === 2 &&
    clauses[0]!.condition === clauses[1]!.condition &&
    clauses[0]!.wind === clauses[1]!.wind &&
    clauses[0]!.temperature === clauses[1]!.temperature
  ) {
    return capitalizeSentence(
      translate('summary.singleToday', {
        condition: describeCondition(
          clauses[0]!.condition,
          undefined,
          clauses[0]!.precipProbability,
          clauses[0]!.wind,
          clauses[0]!.temperature
        ),
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
        condition: describeCondition(
          clause.condition,
          clause.period,
          clause.precipProbability,
          clause.wind,
          clause.temperature
        ),
        period: timing(clause.period),
      })
    );
  }

  if (
    clauses.length === 2 &&
    clauses[0]!.condition === clauses[1]!.condition &&
    !clauses[0]!.wind &&
    clauses[1]!.wind
  ) {
    const wind = translate(`summary.wind.${clauses[1]!.wind}`);
    const key = clauses[1]!.wind === 'breezy' ? 'summary.turningBreezy' : 'summary.turningWind';
    return capitalizeSentence(
      translate(key, {
        condition: describeCondition(
          clauses[0]!.condition,
          clauses[0]!.period,
          clauses[0]!.precipProbability,
          undefined,
          clauses[0]!.temperature
        ),
        wind,
        firstPeriod: timing(clauses[0]!.period),
        secondPeriod: timing(clauses[1]!.period),
      })
    );
  }

  return capitalizeSentence(
    translate('summary.transition', {
      first: describeCondition(
        clauses[0]!.condition,
        clauses[0]!.period,
        clauses[0]!.precipProbability,
        clauses[0]!.wind,
        clauses[0]!.temperature
      ),
      firstPeriod: timing(clauses[0]!.period),
      second: describeCondition(
        clauses[1]!.condition,
        clauses[1]!.period,
        clauses[1]!.precipProbability,
        clauses[1]!.wind,
        clauses[1]!.temperature
      ),
      secondPeriod: timing(clauses[1]!.period),
    })
  );
}
