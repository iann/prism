import type { WeatherCondition } from '@/components/widgets/WeatherWidget';
import { buildForecastPeriods, type ForecastPeriod } from '../forecastPeriods';
import { formatWeatherSummary, type WeatherSummaryTranslator } from '../weatherSummary';

const NOW = Date.parse('2026-08-31T11:00:00Z'); // 7:00 AM in New York

const messages: Record<string, string> = {
  'summary.conditions.sunny': 'mostly sunny',
  'summary.conditions.sunnyBright': 'bright',
  'summary.conditions.sunnySunlit': 'sunlit',
  'summary.conditions.sunnyNight': 'mostly clear',
  'summary.conditions.sunnyNightClear': 'clear',
  'summary.conditions.partly-cloudy': 'partly cloudy',
  'summary.conditions.partlyCloudyBright': 'bright with patchy clouds',
  'summary.conditions.partlyCloudySunClouds': 'partly sunny',
  'summary.conditions.cloudy': 'mostly cloudy',
  'summary.conditions.cloudyGray': 'gray',
  'summary.conditions.cloudyOvercast': 'overcast',
  'summary.conditions.rainy': 'rain',
  'summary.conditions.rainyShowers': 'showery',
  'summary.conditions.rainySteady': 'rainy',
  'summary.conditions.snowy': 'snow',
  'summary.conditions.snowyWintry': 'wintry',
  'summary.conditions.snowyShowers': 'snowy',
  'summary.conditions.stormy': 'storms',
  'summary.conditions.stormyThunderstorms': 'thundery',
  'summary.conditions.stormySkies': 'stormy skies',
  'summary.conditions.withBreezy': '{condition} and breezy',
  'summary.conditions.withWind': '{condition}, with {wind}',
  'summary.conditions.withTemperature': '{temperature} and {condition}',
  'summary.wind.breezy': 'breezy',
  'summary.wind.gusty': 'gusty winds',
  'summary.wind.blustery': 'blustery winds',
  'summary.temperature.freezing': 'freezing',
  'summary.temperature.cold': 'cold',
  'summary.temperature.crisp': 'crisp',
  'summary.temperature.warm': 'warm',
  'summary.temperature.hot': 'hot',
  'summary.periods.morning': 'this morning',
  'summary.periods.afternoon': 'this afternoon',
  'summary.periods.evening': 'tonight',
  'summary.singleTimed': '{condition} {period}.',
  'summary.singleToday': '{condition} today.',
  'summary.transition': '{first} {firstPeriod}, then {second} {secondPeriod}.',
  'summary.turningBreezy': '{condition} {firstPeriod}, turning breezy {secondPeriod}.',
  'summary.turningWind': '{condition} {firstPeriod}, turning {wind} {secondPeriod}.',
};

const translate: WeatherSummaryTranslator = (key, values) => {
  let message = messages[key] ?? key;
  for (const [name, value] of Object.entries(values ?? {})) {
    message = message.replaceAll(`{${name}}`, String(value));
  }
  return message;
};

function period(
  key: NonNullable<ForecastPeriod['period']>,
  condition: WeatherCondition,
  wind: Pick<ForecastPeriod, 'windSpeed' | 'windGust'> = {},
  temp = 70
): ForecastPeriod {
  const labels = { morning: 'Morn', afternoon: 'Aft', evening: 'Eve' };
  return { period: key, label: labels[key], temp, condition, ...wind };
}

describe('formatWeatherSummary', () => {
  it('describes a meaningful timed transition', () => {
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'sunny',
          periods: [period('morning', 'sunny'), period('afternoon', 'rainy')],
          timeZone: 'America/New_York',
          nowMs: NOW,
        },
        translate
      )
    ).toBe('Mostly sunny this morning, then rain this afternoon.');
  });

  it('collapses repeated adjacent conditions', () => {
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'rainy',
          periods: [
            period('morning', 'rainy'),
            period('afternoon', 'rainy'),
            period('evening', 'cloudy'),
          ],
          timeZone: 'America/New_York',
          nowMs: NOW,
        },
        translate
      )
    ).toBe('Rain this morning, then gray tonight.');
  });

  it('uses the observed current condition for the active timed period', () => {
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'rainy',
          periods: [period('morning', 'sunny'), period('afternoon', 'cloudy')],
          timeZone: 'America/New_York',
          nowMs: NOW,
        },
        translate
      )
    ).toBe('Rain this morning, then gray this afternoon.');
  });

  it('uses clear wording for sunny conditions in the evening', () => {
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'sunny',
          periods: [period('evening', 'sunny')],
          timeZone: 'America/New_York',
          nowMs: Date.parse('2026-08-31T23:00:00Z'),
        },
        translate
      )
    ).toBe('Mostly clear tonight.');
  });

  it('adds breezy wording to an evening period when sustained wind is notable', () => {
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'sunny',
          periods: [period('evening', 'sunny', { windSpeed: 15 })],
          windSpeedUnit: 'mph',
          timeZone: 'America/New_York',
          nowMs: Date.parse('2026-08-31T23:00:00Z'),
        },
        translate
      )
    ).toBe('Mostly clear and breezy tonight.');
  });

  it('supports the equivalent metric breezy threshold', () => {
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'sunny',
          periods: [period('afternoon', 'sunny', { windSpeed: 24.1 })],
          windSpeedUnit: 'km/h',
          timeZone: 'America/New_York',
          nowMs: Date.parse('2026-08-31T17:00:00Z'),
        },
        translate
      )
    ).toBe('Mostly sunny and breezy this afternoon.');
  });

  it('adds a crisp descriptor to a cool dry forecast', () => {
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'sunny',
          periods: [period('morning', 'sunny', {}, 50)],
          temperatureUnit: 'F',
          timeZone: 'America/New_York',
          nowMs: NOW,
        },
        translate
      )
    ).toBe('Crisp and mostly sunny this morning.');
  });

  it('uses Celsius thresholds for temperature descriptors', () => {
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'sunny',
          periods: [period('afternoon', 'sunny', {}, 0)],
          temperatureUnit: 'C',
          timeZone: 'America/New_York',
          nowMs: Date.parse('2026-08-31T17:00:00Z'),
        },
        translate
      )
    ).toBe('Freezing and mostly sunny this afternoon.');
  });

  it('uses gusty wording when gusts stand well above sustained wind', () => {
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'sunny',
          periods: [period('afternoon', 'sunny', { windSpeed: 18, windGust: 32 })],
          windSpeedUnit: 'mph',
          timeZone: 'America/New_York',
          nowMs: Date.parse('2026-08-31T17:00:00Z'),
        },
        translate
      )
    ).toBe('Mostly sunny, with gusty winds this afternoon.');
  });

  it('derives breezy wording directly from hourly forecast wind', () => {
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'sunny',
          hourly: [
            {
              time: new Date('2026-08-31T17:00:00Z'), // 1 PM in New York
              condition: 'sunny',
              temp: 78,
              feelsLike: 78,
              windSpeed: 18,
            },
          ],
          windSpeedUnit: 'mph',
          timeZone: 'America/New_York',
          nowMs: NOW,
        },
        translate
      )
    ).toBe('Mostly sunny and breezy this afternoon.');
  });

  it('describes a same-condition shift into breezy weather naturally', () => {
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'sunny',
          periods: [
            period('morning', 'sunny', { windSpeed: 8 }),
            period('afternoon', 'sunny', { windSpeed: 18 }),
          ],
          windSpeedUnit: 'mph',
          timeZone: 'America/New_York',
          nowMs: NOW,
        },
        translate
      )
    ).toBe('Mostly sunny this morning, turning breezy this afternoon.');
  });

  it('suppresses day parts that have already ended at the location', () => {
    const earlyAfternoon = Date.parse('2026-08-31T17:00:00Z'); // 1 PM New York
    const summary = formatWeatherSummary(
      {
        currentCondition: 'rainy',
        periods: [
          period('morning', 'sunny'),
          period('afternoon', 'rainy'),
          period('evening', 'cloudy'),
        ],
        timeZone: 'America/New_York',
        nowMs: earlyAfternoon,
      },
      translate
    );

    expect(summary).toBe('Rain this afternoon, then gray tonight.');
    expect(summary).not.toContain('morning');
  });

  it('uses the forecast timezone across a UTC day boundary', () => {
    const nowMs = Date.parse('2026-05-01T02:00:00Z'); // Apr 30, 10 PM New York
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'snowy',
          hourly: [
            {
              time: new Date('2026-05-01T00:00:00Z'), // Apr 30, 8 PM New York
              condition: 'snowy',
              temp: 32,
              feelsLike: 27,
            },
          ],
          timeZone: 'America/New_York',
          nowMs,
        },
        translate
      )
    ).toBe('Snow tonight.');
  });

  it('falls back to the normalized current condition without safe timing data', () => {
    expect(formatWeatherSummary({ currentCondition: 'cloudy' }, translate)).toBe(
      'Mostly cloudy today.'
    );
  });

  it('does not invent an uncovered day part', () => {
    const summary = formatWeatherSummary(
      {
        currentCondition: 'cloudy',
        periods: [period('afternoon', 'rainy')],
        timeZone: 'America/New_York',
        nowMs: NOW,
      },
      translate
    );
    expect(summary).toBe('Rain this afternoon.');
    expect(summary).not.toContain('morning');
  });

  it('keeps the first run and the most salient later run when capped at two clauses', () => {
    const input = {
      currentCondition: 'sunny' as const,
      periods: [
        period('morning', 'sunny'),
        period('afternoon', 'stormy'),
        period('evening', 'sunny'),
      ],
      timeZone: 'America/New_York',
      nowMs: NOW,
    };
    const first = formatWeatherSummary(input, translate);
    expect(first).toBe('Mostly sunny this morning, then storms this afternoon.');
    expect(formatWeatherSummary(input, translate)).toBe(first);
    expect(first.split(', then ')).toHaveLength(2);
  });

  it('uses day-level wording when the capped summary repeats the same condition', () => {
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'cloudy',
          periods: [
            period('morning', 'cloudy'),
            period('afternoon', 'partly-cloudy'),
            period('evening', 'cloudy'),
          ],
          timeZone: 'America/New_York',
          nowMs: NOW,
        },
        translate
      )
    ).toBe('Gray today.');
  });

  it.each([
    ['Morn', NOW, 'this morning'],
    ['Aft', Date.parse('2026-08-31T17:00:00Z'), 'this afternoon'],
    ['Eve', Date.parse('2026-08-31T23:00:00Z'), 'tonight'],
  ])('supports the legacy %s alias without a date key', (label, nowMs, timing) => {
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'rainy',
          periods: [{ label, temp: 70, condition: 'rainy' }],
          timeZone: 'America/New_York',
          nowMs,
        },
        translate
      )
    ).toBe(`Rain ${timing}.`);
  });

  it('rejects a provider period from a stale location-local date', () => {
    expect(
      formatWeatherSummary(
        {
          currentCondition: 'cloudy',
          periods: [
            {
              ...period('morning', 'sunny'),
              dateKey: '2026-08-30',
            },
          ],
          timeZone: 'America/New_York',
          nowMs: NOW,
        },
        translate
      )
    ).toBe('Gray today.');
  });
});

describe('buildForecastPeriods', () => {
  const timeZone = 'America/New_York';
  const earlyMorning = Date.parse('2026-08-31T09:00:00Z'); // 5 AM New York

  it.each([
    ['stormy', ['sunny', 'sunny', 'stormy'] as const],
    ['rainy', ['sunny', 'sunny', 'rainy'] as const],
  ])('keeps an isolated %s condition visible', (expected, conditions) => {
    const periods = buildForecastPeriods(
      conditions.map((condition, index) => ({
        time: new Date(Date.parse('2026-08-31T10:00:00Z') + index * 3_600_000),
        temp: 70 + index,
        condition,
      })),
      { timeZone },
      earlyMorning
    );

    expect(periods[0]).toMatchObject({
      period: 'morning',
      dateKey: '2026-08-31',
      condition: expected,
    });
  });

  it('prefers snow over rain when both occur in a period', () => {
    const periods = buildForecastPeriods(
      [
        { time: '2026-08-31T10:00:00Z', temp: 35, condition: 'rainy' as const },
        { time: '2026-08-31T11:00:00Z', temp: 33, condition: 'snowy' as const },
        { time: '2026-08-31T12:00:00Z', temp: 36, condition: 'rainy' as const },
      ],
      { timeZone },
      earlyMorning
    );

    expect(periods[0]?.condition).toBe('snowy');
  });

  it('uses the dry-condition mode and severity only to break a tie', () => {
    const modeWinner = buildForecastPeriods(
      [
        { time: '2026-08-31T10:00:00Z', temp: 70, condition: 'sunny' as const },
        { time: '2026-08-31T11:00:00Z', temp: 71, condition: 'sunny' as const },
        { time: '2026-08-31T12:00:00Z', temp: 72, condition: 'cloudy' as const },
      ],
      { timeZone },
      earlyMorning
    );
    const tieWinner = buildForecastPeriods(
      [
        { time: '2026-08-31T10:00:00Z', temp: 70, condition: 'partly-cloudy' as const },
        { time: '2026-08-31T11:00:00Z', temp: 71, condition: 'cloudy' as const },
      ],
      { timeZone },
      earlyMorning
    );

    expect(modeWinner[0]?.condition).toBe('sunny');
    expect(tieWinner[0]?.condition).toBe('cloudy');
  });

  it('prefers remaining samples in the active period and uses every future-period sample', () => {
    const periods = buildForecastPeriods(
      [
        {
          time: '2026-08-31T13:00:00Z', // 9 AM, already elapsed
          temp: 60,
          condition: 'rainy',
        },
        {
          time: '2026-08-31T15:00:00Z', // 11 AM, still ahead
          temp: 80,
          condition: 'sunny',
        },
        {
          time: '2026-08-31T16:00:00Z', // noon
          temp: 70,
          condition: 'sunny',
        },
        {
          time: '2026-08-31T17:00:00Z', // 1 PM
          temp: 80,
          condition: 'rainy',
        },
      ],
      { timeZone },
      Date.parse('2026-08-31T14:30:00Z') // 10:30 AM New York
    );

    expect(periods.find((candidate) => candidate.period === 'morning')).toMatchObject({
      temp: 80,
      condition: 'sunny',
    });
    expect(periods.find((candidate) => candidate.period === 'afternoon')).toMatchObject({
      temp: 75,
      condition: 'rainy',
    });
  });

  it('falls back to all active-period samples when none remain', () => {
    const periods = buildForecastPeriods(
      [
        { time: '2026-08-31T13:00:00Z', temp: 60, condition: 'partly-cloudy' },
        { time: '2026-08-31T15:00:00Z', temp: 70, condition: 'cloudy' },
      ],
      { timeZone },
      Date.parse('2026-08-31T15:30:00Z') // 11:30 AM New York
    );

    expect(periods[0]).toMatchObject({ temp: 65, condition: 'cloudy' });
  });

  it('averages forecast wind across the representative samples', () => {
    const periods = buildForecastPeriods(
      [
        { time: '2026-08-31T13:00:00Z', temp: 70, condition: 'sunny', windSpeed: 12, windGust: 20 },
        { time: '2026-08-31T15:00:00Z', temp: 71, condition: 'sunny', windSpeed: 18, windGust: 30 },
      ],
      { timeZone },
      earlyMorning
    );

    expect(periods.find((candidate) => candidate.period === 'morning')).toMatchObject({
      windSpeed: 15,
      windGust: 25,
    });
  });
});
