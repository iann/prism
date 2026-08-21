/**
 * @jest-environment jsdom
 *
 * Tests for WeatherWidget — covering the hourly timeline, the day
 * summary header, the forecastDays prop, current conditions, and loading /
 * error / fallback states.
 */

import React from 'react';
import { act, render as rtlRender, screen, within, type RenderOptions } from '@testing-library/react';
import SunCalc from 'suncalc';
import { TimeFormatProvider } from '@/components/providers';

// WeatherWidget consumes useTimeFormat(), which requires a TimeFormatProvider
// ancestor. Wrap every render so the widget mounts the way it does in the app.
const render = (ui: React.ReactElement, options?: RenderOptions) =>
  rtlRender(ui, { wrapper: TimeFormatProvider, ...options });

// TimeFormatProvider fetches /api/settings on mount; jsdom has no global fetch,
// so stub it to a benign empty-settings response (the widget falls back to
// DEFAULT_TIME_FORMAT / UTC, which is what these assertions expect).
beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ settings: {} }) }),
  ) as unknown as typeof fetch;
});
afterAll(() => {
  delete (global as { fetch?: unknown }).fetch;
});

// --- mocks (must precede component import) ---------------------------------

// Stub WidgetContainer so we don't pull in next/link, Radix UI, etc.
jest.mock('../WidgetContainer', () => ({
  WidgetContainer: function MockWidgetContainer({
    children,
    title,
    loading,
    error,
  }: {
    children: React.ReactNode;
    title?: string;
    loading?: boolean;
    error?: string | null;
  }) {
    if (loading) return <div data-testid="loading-state">Loading</div>;
    if (error) return <div data-testid="error-state">{error}</div>;
    return (
      <div data-testid="widget-container">
        {title && <div data-testid="widget-title">{title}</div>}
        {children}
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------

import { getAirQualityStatus, getUvIndexStatus, WeatherWidget } from '../WeatherWidget';
import type {
  WeatherAlert,
  WeatherData,
  ForecastDay,
  HourlyForecast,
  WeatherCondition,
} from '../WeatherWidget';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

// Anchor to noon tomorrow so the past-day filter never drops fixture dates.
const NOON_MS = new Date().setHours(12, 0, 0, 0);
const TOMORROW_NOON = new Date(NOON_MS + 86_400_000);
const DAY_MS = 86_400_000;

function makeForecastDay(overrides: Partial<ForecastDay> = {}): ForecastDay {
  return {
    date: TOMORROW_NOON,
    dayName: 'Tue',
    high: 72,
    low: 55,
    condition: 'sunny',
    ...overrides,
  };
}

/**
 * Build 24 hourly items anchored to the current hour so they pass the
 * "endTime in the future" filter in HourlyTimeline. The first item is "now",
 * the second is "now + 1 hour", etc.
 */
function makeHourlyForecast(
  conditionOrList: WeatherCondition | WeatherCondition[] = 'sunny',
  tempOrTemps: number | number[] = 70
): HourlyForecast[] {
  const conditions: WeatherCondition[] = Array.isArray(conditionOrList)
    ? conditionOrList
    : Array(24).fill(conditionOrList);
  const temperatures = Array.isArray(tempOrTemps)
    ? tempOrTemps
    : Array(24).fill(tempOrTemps);

  // Anchor to the top of the current hour
  const base = new Date();
  base.setMinutes(0, 0, 0);

  return Array.from({ length: 24 }, (_, i) => ({
    time: new Date(base.getTime() + i * 60 * 60_000),
    condition: conditions[i] ?? 'sunny',
    temp: temperatures[i] ?? temperatures[temperatures.length - 1] ?? 70,
    feelsLike: (temperatures[i] ?? temperatures[temperatures.length - 1] ?? 70) - 2,
    precipProbability: 20,
  }));
}

function makeUvTrendForecast(uvIndex: number): HourlyForecast[] {
  return [{
    time: new Date(Date.now() + 60 * 60_000),
    condition: 'sunny',
    temp: 70,
    feelsLike: 68,
    uvIndex,
    precipProbability: 0,
  }];
}

const DEFAULT_UNITS = {
  temperature: 'F' as const,
  windSpeed: 'mph' as const,
  precipitation: 'in' as const,
};

function mockConditionBandLayout(bandWidth: number, fullLabelWidth: number) {
  const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const rectDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect');
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return this.hasAttribute('data-condition-band') ? bandWidth : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function (this: HTMLElement) {
      const rect = originalGetBoundingClientRect.call(this);
      return this.hasAttribute('data-condition-measure')
        ? { ...rect, width: fullLabelWidth }
        : rect;
    },
  });

  return () => {
    if (clientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidthDescriptor);
    }
    if (rectDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', rectDescriptor);
    }
  };
}

/** Build a full WeatherData object. */
function makeWeatherData(overrides: Partial<WeatherData> = {}): WeatherData {
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Start from tomorrow so no entry lands on "today" (which renders as 'TODAY'
  // rather than the dayName, breaking tests that check for specific day labels).
  const forecast: ForecastDay[] = DAY_NAMES.slice(0, 5).map((dayName, i) => ({
    date: new Date(NOON_MS + (1 + i) * DAY_MS),
    dayName,
    high: 70 + i,
    low: 50 + i,
    condition: 'sunny' as WeatherCondition,
  }));

  return {
    location: 'Chicago, IL',
    units: DEFAULT_UNITS,
    current: {
      temperature: 68,
      feelsLike: 65,
      condition: 'sunny',
      humidity: 45,
      windSpeed: 10,
      description: 'Clear sky',
    },
    forecast,
    hourly: makeHourlyForecast('sunny'),
    lastUpdated: new Date(),
    ...overrides,
  };
}

// ===========================================================================
// 1. Hourly glance panel
// ===========================================================================
// The hourly section samples five moments from the next nine hours into a
// compact, theme-aware row suitable for a wall display.

describe('hourly timeline', () => {
  it('renders the section header', () => {
    render(<WeatherWidget data={makeWeatherData()} />);
    expect(screen.queryByText(/Next 9 Hours/)).not.toBeNull();
  });

  it('renders the themed hourly panel', () => {
    const { container } = render(<WeatherWidget data={makeWeatherData()} />);
    expect(container.querySelector('[data-keep-bg]')).not.toBeNull();
  });

  it('keeps the hourly condition ribbon visible', () => {
    render(<WeatherWidget data={makeWeatherData({ hourly: makeHourlyForecast('rainy', 68) })} />);
    expect(screen.queryByLabelText('Hourly conditions')).not.toBeNull();
    expect(screen.queryAllByText('Rain').length).toBeGreaterThan(0);
  });

  it('keeps condition labels in the ribbon instead of repeating them in tiles', () => {
    render(<WeatherWidget data={makeWeatherData({ hourly: makeHourlyForecast('sunny', 68) })} />);
    expect(screen.queryByLabelText('Hourly conditions')).not.toBeNull();
    expect(screen.getAllByTestId('hourly-sample')[0]?.textContent).not.toContain('Clear');
  });

  it('shows the full condition label when the band has room', () => {
    const restoreLayout = mockConditionBandLayout(120, 90);
    try {
      const data = makeWeatherData({
        hourly: makeHourlyForecast([
          'partly-cloudy', 'partly-cloudy', 'partly-cloudy',
          'sunny', 'sunny', 'sunny', 'sunny', 'sunny', 'sunny',
        ]),
      });
      const { container } = render(<WeatherWidget data={data} />);

      expect(container.querySelector('[data-condition-label="partly-cloudy"]')?.textContent)
        .toBe('Partly Cloudy');
    } finally {
      restoreLayout();
    }
  });

  it('keeps the compact condition label when the band is too narrow', () => {
    const restoreLayout = mockConditionBandLayout(80, 90);
    try {
      const data = makeWeatherData({
        hourly: makeHourlyForecast([
          'partly-cloudy', ...Array(23).fill('sunny') as WeatherCondition[],
        ]),
      });
      const { container } = render(<WeatherWidget data={data} />);

      expect(container.querySelector('[data-condition-label="partly-cloudy"]')?.textContent)
        .toBe('Partly');
    } finally {
      restoreLayout();
    }
  });

  it('renders the hourly temperature in each card', () => {
    const data = makeWeatherData({ hourly: makeHourlyForecast('sunny', 73) });
    render(<WeatherWidget data={data} />);
    // The temp appears in hourly cards and possibly current conditions; just
    // check that at least one occurrence is visible.
    expect(screen.queryAllByText(/73°/).length).toBeGreaterThan(0);
  });

  it('renders hourly times with an am/pm suffix', () => {
    render(<WeatherWidget data={makeWeatherData()} />);

    const secondSample = screen.getAllByTestId('hourly-sample')[1]!;
    expect(secondSample.textContent).toMatch(/\d+(am|pm)/i);
  });

  it('renders hourly feels-like temperatures and precipitation chance', () => {
    const data = makeWeatherData({ hourly: makeHourlyForecast('sunny', 73) });
    render(<WeatherWidget data={data} />);

    const firstSample = screen.getAllByTestId('hourly-sample')[0]!;
    expect(firstSample.textContent).toContain('73° | 71°');
    expect(firstSample.textContent).toContain('20%');
  });

  it('converts hourly temps to °C when useCelsius=true', () => {
    // 32°F → 0°C
    const data = makeWeatherData({ hourly: makeHourlyForecast('sunny', 32) });
    render(<WeatherWidget data={data} useCelsius />);
    expect(screen.queryAllByText(/0°/).length).toBeGreaterThan(0);
  });

  it('renders nothing for the hourly section when no hourly data', () => {
    render(<WeatherWidget data={makeWeatherData({ hourly: [] })} />);
    expect(screen.queryByText(/Next .* Hours/)).toBeNull();
  });

  it('hides the hourly section when showForecast=false', () => {
    render(<WeatherWidget data={makeWeatherData()} showForecast={false} />);
    expect(screen.queryByText(/Next .* Hours/)).toBeNull();
  });
});

describe('active weather alerts', () => {
  it('renders the active alert event, headline, and severity styling', () => {
    const alert: WeatherAlert = {
      id: 'heat-advisory',
      title: 'Heat Advisory',
      headline: 'Heat Advisory remains in effect',
      description: 'Heat index values may become dangerous.',
      severity: 'moderate',
      end: (() => {
        const end = new Date();
        end.setHours(20, 5, 0, 0);
        return end;
      })(),
    };

    render(<WeatherWidget data={makeWeatherData({ alerts: [alert] })} />);

    expect(screen.getByTestId('weather-alerts').getAttribute('aria-label')).toBe(
      '1 active weather alert',
    );
    expect(screen.getByRole('alert', { name: 'Heat Advisory active weather alert' }).textContent)
      .toContain('Heat Advisory');
    expect(screen.getByText('Heat Advisory remains in effect')).not.toBeNull();
    expect(screen.getByRole('alert').className).toContain('border-orange-500/80');
    expect(screen.getByRole('alert').textContent).toMatch(/Until 8:05 PM/);
  });

  it('keeps the banner compact when several alerts are active', () => {
    const alerts: WeatherAlert[] = [
      { id: 'one', title: 'Tornado Warning', severity: 'extreme' },
      { id: 'two', title: 'Flood Watch', severity: 'moderate' },
      { id: 'three', title: 'Wind Advisory', severity: 'minor' },
    ];

    render(<WeatherWidget data={makeWeatherData({ alerts })} />);

    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByText('+1 more active alert')).not.toBeNull();
  });
});
describe('precipitation notice', () => {
  it('renders a compact themed next-hour header and timing message', () => {
    const minutely = Array.from({ length: 61 }, (_, index) => ({
      time: index * 60,
      precipIntensity: 0.2,
      precipProbability: 1,
    }));
    const { container } = render(<WeatherWidget data={makeWeatherData({ minutely })} />);

    const header = container.querySelector('[data-precipitation-header]');
    expect(header?.textContent).toContain('Next hour');
    expect(header?.textContent).not.toContain('68°');
    expect(
      screen.getByText('Raining through the hour').classList.contains('precipitation-wave-message')
    ).toBe(true);
    expect(screen.getByText('Raining through the hour').classList.contains('text-primary')).toBe(
      false
    );
    expect(container.querySelector('.text-blue-400')).toBeNull();
  });

  it('normalizes imperial rain and calibrates the current point to about 40%', () => {
    const minutely = [
      { time: 0, precipIntensity: 0.0583, precipProbability: 0.7 },
      { time: 60, precipIntensity: 0.08, precipProbability: 0.7 },
    ];
    const { container } = render(<WeatherWidget data={makeWeatherData({ minutely })} />);

    const chart = container.querySelector('[data-precipitation-scale]');
    const line = container.querySelector('[data-precipitation-line]');
    expect(chart?.getAttribute('data-precipitation-scale')).toBe('7.62');
    // 0.0583 in/hr = 1.48 mm/hr, which is ~44% after the square-root curve.
    expect(line?.getAttribute('d')).toMatch(/^M 4\.0 37\.[0-9]/);
  });

  it('leaves headroom for a moderate shower instead of clipping it at full scale', () => {
    const minutely = Array.from({ length: 61 }, (_, index) => ({
      time: index * 60,
      precipIntensity: index === 0 ? 0.1343 : 0.12,
      precipProbability: 0.9,
    }));
    const { container } = render(<WeatherWidget data={makeWeatherData({ minutely })} />);

    const chart = container.querySelector('[data-precipitation-scale]');
    const line = container.querySelector('[data-precipitation-line]');
    expect(chart?.getAttribute('data-precipitation-scale')).toBe('7.62');
    // 0.1343 in/hr = 3.41 mm/hr, which lands around 67% of the height.
    expect(line?.getAttribute('d')).toMatch(/^M 4\.0 23\.[0-9]/);
  });

  it('renders the precipitation forecast as a smooth animated wave', () => {
    const minutely = Array.from({ length: 5 }, (_, index) => ({
      time: index * 60,
      precipIntensity: 0.2,
      precipProbability: 1,
    }));
    const { container } = render(<WeatherWidget data={makeWeatherData({ minutely })} />);

    const guideYs = ['heavy', 'medium', 'light'].map((level) =>
      Number(container.querySelector(`[data-precipitation-guide="${level}"]`)?.getAttribute('y1'))
    );
    expect(guideYs).toHaveLength(3);
    const heavyToMedium = guideYs[1]! - guideYs[0]!;
    const mediumToLight = guideYs[2]! - guideYs[1]!;
    expect(heavyToMedium).toBeCloseTo(mediumToLight);
    expect(container.querySelector('[data-precipitation-area]')).not.toBeNull();
    expect(container.querySelector('[data-precipitation-variation]')).not.toBeNull();
    expect(
      container
        .querySelector('[data-precipitation-variation]')
        ?.getAttribute('data-precipitation-variation-percent')
    ).toBe('5');
    expect(container.querySelector('[data-precipitation-line]')).not.toBeNull();
    expect(container.querySelectorAll('[data-precipitation-jitter-morph]')).toHaveLength(2);
    expect(
      Array.from(container.querySelectorAll('[data-precipitation-jitter-morph]')).map((animation) =>
        animation.getAttribute('dur')
      )
    ).toEqual(['3.2s', '3.2s']);
    expect(container.querySelector('[data-precipitation-line]')?.getAttribute('d')).toContain('C ');
    expect(container.querySelector('.precipitation-wave-highlight')).toBeNull();
    expect(container.querySelector('stop')?.getAttribute('stop-color')).toBe(
      'hsl(var(--weather-precipitation))'
    );
    expect(container.querySelector('[data-precipitation-line]')?.getAttribute('stroke')).toBe(
      'hsl(var(--weather-precipitation))'
    );
    const chart = container.querySelector('[data-precipitation-scale]');
    expect(chart?.getAttribute('data-precipitation-undulation-px')).toBe('4');
    const linePathNumbers = container
      .querySelector('[data-precipitation-line]')
      ?.getAttribute('d')
      ?.match(/-?\d+(?:\.\d+)?/g)
      ?.map(Number) ?? [];
    const lineYValues = linePathNumbers.filter((_, index) => index % 2 === 1);
    expect(Math.max(...lineYValues)).toBeLessThanOrEqual(
      Number(chart?.getAttribute('data-precipitation-baseline'))
    );
    expect(container.querySelector('[data-precipitation-variation]')?.getAttribute('d')).not.toBe(
      container.querySelector('[data-precipitation-line]')?.getAttribute('d')
    );
    expect(container.querySelectorAll('rect')).toHaveLength(0);
  });
});

// ===========================================================================
// 2. Day summary header (driven by forecastDays, not the hourly row)
// ===========================================================================

describe('day summary header', () => {
  it('renders a label for each forecast day', () => {
    const data = makeWeatherData({
      forecast: [
        makeForecastDay({ dayName: 'Mon' }),
        makeForecastDay({ dayName: 'Tue', date: new Date(NOON_MS + 2 * DAY_MS) }),
        makeForecastDay({ dayName: 'Wed', date: new Date(NOON_MS + 3 * DAY_MS) }),
      ],
    });
    render(<WeatherWidget data={data} forecastDays={3} />);

    // Widget calls dayName.toUpperCase() — DOM has 'MON' not 'Mon'
    expect(screen.queryByText('MON')).not.toBeNull();
    expect(screen.queryByText('TUE')).not.toBeNull();
    expect(screen.queryByText('WED')).not.toBeNull();
  });

  it('renders the correct number of day columns', () => {
    const data = makeWeatherData();
    const { container } = render(<WeatherWidget data={data} forecastDays={4} />);

    const dayColumns = container.querySelectorAll('[class*="flex-1"]');
    expect(dayColumns.length).toBeGreaterThanOrEqual(4);
  });

  it('shows the high temperature for each day in °F', () => {
    const data = makeWeatherData({
      forecast: [makeForecastDay({ dayName: 'Mon', high: 88, low: 60 })],
    });
    render(<WeatherWidget data={data} forecastDays={1} />);
    expect(screen.queryAllByText(/88°/).length).toBeGreaterThan(0);
  });

  it('shows the low temperature for each day in °F', () => {
    const data = makeWeatherData({
      forecast: [makeForecastDay({ dayName: 'Mon', high: 72, low: 44 })],
    });
    render(<WeatherWidget data={data} forecastDays={1} />);
    expect(screen.queryAllByText(/44°/).length).toBeGreaterThan(0);
  });

  it('displays temperatures as-is when data.units.temperature is C', () => {
    // Server returned values in °C — widget should not re-convert.
    const data = makeWeatherData({
      units: { temperature: 'C', windSpeed: 'km/h', precipitation: 'mm' },
      forecast: [makeForecastDay({ high: 35, low: 10 })],
    });
    render(<WeatherWidget data={data} forecastDays={1} />);
    expect(screen.queryAllByText(/35°/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/10°/).length).toBeGreaterThan(0);
  });

  it('renders an icon for each day in the header', () => {
    const data = makeWeatherData();
    const { container } = render(<WeatherWidget data={data} forecastDays={3} />);

    const svgs = container.querySelectorAll('svg');
    // At minimum: 1 current-conditions icon + 3 day header icons + hourly icons
    expect(svgs.length).toBeGreaterThanOrEqual(4);
  });
});

// ===========================================================================
// 3. forecastDays prop — controls the day summary, not the hourly cards
// ===========================================================================

describe('forecastDays prop', () => {
  it('picks the forecast length from the widget height when not specified', () => {
    const data = makeWeatherData();
    const { rerender } = render(<WeatherWidget data={data} gridH={17} />);
    expect(screen.queryByText('5-Day Forecast')).not.toBeNull();
    rerender(<WeatherWidget data={data} gridH={12} />);
    expect(screen.queryByText('3-Day Forecast')).not.toBeNull();
  });

  it('respects an explicit forecastDays value', () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} forecastDays={3} />);
    expect(screen.queryByText('3-Day Forecast')).not.toBeNull();
  });

  it('shows only forecastDays day columns in the header', () => {
    const data = makeWeatherData(); // 5 days: Mon–Fri
    render(<WeatherWidget data={data} forecastDays={2} />);

    expect(screen.queryByText('MON')).not.toBeNull();
    expect(screen.queryByText('TUE')).not.toBeNull();
    expect(screen.queryByText('WED')).toBeNull();
  });

  it('shows only available days when fewer than forecastDays exist', () => {
    const data = makeWeatherData({
      forecast: [
        makeForecastDay({ dayName: 'Mon' }),
        makeForecastDay({ dayName: 'Tue', date: new Date(NOON_MS + 2 * DAY_MS) }),
      ],
    });
    render(<WeatherWidget data={data} forecastDays={5} />);

    // Label reflects actual visible days, not the requested prop
    expect(screen.queryByText('2-Day Forecast')).not.toBeNull();
    // Header shows only the 2 days that exist
    expect(screen.queryByText('MON')).not.toBeNull();
    expect(screen.queryByText('TUE')).not.toBeNull();
    expect(screen.queryByText('WED')).toBeNull();
  });
});

// ===========================================================================
// 4. Current conditions display
// ===========================================================================

describe('current conditions', () => {
  it('renders the current temperature with a degree symbol by default', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, temperature: 73 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('73°')).not.toBeNull();
  });

  it('shows a red fallback indicator when Pirate Weather is supplying current data', () => {
    render(<WeatherWidget data={makeWeatherData({ currentSource: 'pirate' })} />);

    expect(screen.getByTestId('weather-fallback-indicator').getAttribute('aria-label'))
      .toBe('Using Pirate Weather fallback data');
  });

  it('keeps the fallback indicator centered with the numeric temperature', () => {
    render(<WeatherWidget data={makeWeatherData({
      currentSource: 'pirate',
      hourly: makeHourlyForecast('sunny', [70, 72, 74]),
    })} />);

    const temperature = screen.getByTestId('weather-current-temperature');
    const fallbackIndicator = screen.getByTestId('weather-fallback-indicator');
    const trend = screen.getByTestId('weather-temperature-trend');

    expect(temperature.firstElementChild?.contains(fallbackIndicator)).toBe(true);
    expect(temperature.firstElementChild?.nextElementSibling).toBe(trend);
  });

  it('does not show the fallback indicator for the local sensor source', () => {
    render(<WeatherWidget data={makeWeatherData({ currentSource: 'airgradient' })} />);

    expect(screen.queryByTestId('weather-fallback-indicator')).toBeNull();
  });

  it('renders °C suffix when data.units.temperature is C', () => {
    // Server returns 0°C directly — widget renders the value with the unit
    // from data.units, not by client-side conversion.
    const data = makeWeatherData({
      units: { temperature: 'C', windSpeed: 'km/h', precipitation: 'mm' },
      current: { ...makeWeatherData().current, temperature: 0 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('0°C')).not.toBeNull();
  });

  it('adds a rising suffix when future forecast points get warmer', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, temperature: 80 },
      hourly: makeHourlyForecast('sunny', [70, 72, 74]),
    });
    render(<WeatherWidget data={data} />);

    expect(screen.getByTestId('weather-temperature-trend').textContent).toBe('& rising');
  });

  it('adds a falling suffix when future forecast points get cooler', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, temperature: 72 },
      hourly: makeHourlyForecast('sunny', [70, 68, 66]),
    });
    render(<WeatherWidget data={data} />);

    expect(screen.getByTestId('weather-temperature-trend').textContent).toBe('& falling');
  });

  it('omits the suffix when the next hour is steady', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, temperature: 70 },
      hourly: makeHourlyForecast('sunny', 70),
    });
    render(<WeatherWidget data={data} />);

    expect(screen.queryByTestId('weather-temperature-trend')).toBeNull();
  });

  it('does not render the weather location in the right-side stats', () => {
    const data = makeWeatherData({ location: 'Denver, Colorado, US 80202' });
    render(<WeatherWidget data={data} />);
    const stats = within(screen.getByTestId('weather-current-stats'));
    expect(stats.queryByText('Denver, CO')).toBeNull();
    expect(stats.queryByText('80202')).toBeNull();
  });

  it('does not repeat the current condition in the right-side stats', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, description: 'Partly cloudy' },
    });
    render(<WeatherWidget data={data} />);

    expect(within(screen.getByTestId('weather-current-stats')).queryByText('Partly cloudy')).toBeNull();
  });

  it('keeps sunrise, sunset, and moon phase out of the current-condition stats', () => {
    const data = makeWeatherData({
      sunrise: new Date(2026, 6, 17, 6, 27),
      sunset: new Date(2026, 6, 17, 19, 48),
      moonPhaseName: 'Waning Gibbous',
    });
    render(<WeatherWidget data={data} />);

    const stats = within(screen.getByTestId('weather-current-stats'));
    expect(stats.queryByText('Waning Gibbous')).toBeNull();
    expect(stats.queryByText(/6:27/)).toBeNull();
    expect(stats.queryByText(/7:48/)).toBeNull();
  });

  it('renders the "feels like" temperature', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, feelsLike: 60 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText(/Feels like 60°/)).not.toBeNull();
  });

  it('renders humidity percentage', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, humidity: 78 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('78%')).not.toBeNull();
  });

  it('renders wind speed in mph', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, windSpeed: 15 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('15 mph')).not.toBeNull();
  });

  it('renders wind gusts, UV index, dew point, and visibility', () => {
    const data = makeWeatherData({
      current: {
        ...makeWeatherData().current,
        windSpeed: 15,
        windGust: 20,
        uvIndex: 6.5,
        dewPoint: 62,
        visibility: 9.5,
      },
    });
    render(<WeatherWidget data={data} />);

    const stats = within(screen.getByTestId('weather-current-stats'));
    expect(stats.queryByText(/15 mph · Gusts 20 mph/)).not.toBeNull();
    expect(stats.queryByText('UV 6.5')).not.toBeNull();
    expect(stats.queryByText('Dew point 62°')).not.toBeNull();
    expect(stats.queryByText('Visibility 9.5 mi')).not.toBeNull();
    expect(stats.getByTestId('weather-humidity-dewpoint').textContent).toContain('45%');
    expect(stats.getByTestId('weather-humidity-dewpoint').textContent).toContain('Dew point 62°');

    const uvLine = screen.getByTestId('uv-index-line');
    expect(uvLine.textContent).toBe('UV 6.5');
    expect(uvLine.getAttribute('title')).toBe('UV index 6.5: High');
    expect(uvLine.getAttribute('aria-label')).toBe('UV index 6.5, High');
    expect(uvLine.className).not.toContain('text-orange-700');
    expect(screen.getByTestId('uv-index-dot').className).toContain('bg-orange-500');
    expect(screen.getByTestId('uv-index-dot').className).toContain('uv-index-dot--pulse');
    expect(uvLine.querySelector('svg')).toBeNull();
  });

  it('shows the warning dot at UV 5 and above, but not below the threshold', () => {
    const { queryByTestId, rerender } = render(
      <WeatherWidget data={makeWeatherData({ current: { ...makeWeatherData().current, uvIndex: 4.9 } })} />
    );
    expect(queryByTestId('uv-index-line')).not.toBeNull();
    expect(queryByTestId('uv-index-dot')).toBeNull();

    rerender(
      <WeatherWidget data={makeWeatherData({ current: { ...makeWeatherData().current, uvIndex: 5 } })} />
    );
    expect(screen.getByTestId('uv-index-dot').className).toContain('bg-yellow-500');
  });

  it('uses a risk-colored up chevron when UV is increasing', () => {
    render(
      <WeatherWidget
        data={makeWeatherData({
          current: { ...makeWeatherData().current, uvIndex: 6.5 },
          hourly: makeUvTrendForecast(7.5),
        })}
      />
    );

    const chevron = screen.getByTestId('uv-index-up-chevron');
    expect(chevron.getAttribute('class')).toContain('text-orange-500');
    expect(screen.queryByTestId('uv-index-dot')).toBeNull();
    expect(screen.queryByTestId('uv-index-down-chevron')).toBeNull();
    expect(screen.getByTestId('uv-index-line').getAttribute('aria-label')).toBe(
      'UV index 6.5, High, increasing'
    );
  });

  it('uses a risk-colored down chevron when UV is decreasing', () => {
    render(
      <WeatherWidget
        data={makeWeatherData({
          current: { ...makeWeatherData().current, uvIndex: 6.5 },
          hourly: makeUvTrendForecast(5.5),
        })}
      />
    );

    const chevron = screen.getByTestId('uv-index-down-chevron');
    expect(chevron.getAttribute('class')).toContain('text-orange-500');
    expect(screen.queryByTestId('uv-index-dot')).toBeNull();
    expect(screen.queryByTestId('uv-index-up-chevron')).toBeNull();
    expect(screen.getByTestId('uv-index-line').getAttribute('aria-label')).toBe(
      'UV index 6.5, High, decreasing'
    );
  });

  it('removes the UV line when the sun is below the horizon', () => {
    const now = Date.now();
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, uvIndex: 6.5 },
      sunrise: new Date(now - 2 * 60 * 60 * 1000),
      sunset: new Date(now - 60 * 60 * 1000),
    });

    render(<WeatherWidget data={data} />);
    expect(screen.queryByTestId('uv-index-line')).toBeNull();
  });

  it('maps UV index values to the visual risk bands', () => {
    expect(getUvIndexStatus(2)?.label).toBe('Low');
    expect(getUvIndexStatus(2.1)?.label).toBe('Moderate');
    expect(getUvIndexStatus(5.1)?.label).toBe('High');
    expect(getUvIndexStatus(7.1)?.label).toBe('Very High');
    expect(getUvIndexStatus(10.1)?.label).toBe('Extreme');
    expect(getUvIndexStatus(-1)).toBeNull();
    expect(getUvIndexStatus(Number.NaN)).toBeNull();

    const { getByTestId } = render(
      <WeatherWidget
        data={makeWeatherData({ current: { ...makeWeatherData().current, uvIndex: 14 } })}
      />
    );
    expect(getByTestId('uv-index-line').textContent).toBe('UV 14');
    expect(getByTestId('uv-index-dot').className).toContain('bg-purple-500');
    expect(getByTestId('uv-index-dot').className).toContain('uv-index-dot--pulse');
  });

  it('pulses the warning dot at the high and red UV thresholds', () => {
    render(
      <WeatherWidget
        data={makeWeatherData({ current: { ...makeWeatherData().current, uvIndex: 8 } })}
      />
    );

    const dot = screen.getByTestId('uv-index-dot');
    expect(dot.className).toContain('bg-red-500');
    expect(dot.className).toContain('uv-index-dot--pulse');
  });

  it('renders the EPA-style air quality badge for the local PM2.5 reading', () => {
    const data = makeWeatherData({
      current: {
        ...makeWeatherData().current,
        airQuality: { pm25: 27 },
      },
    });
    render(<WeatherWidget data={data} />);

    const badge = screen.getByTestId('air-quality-badge');
    expect(badge.textContent).toBe('Air: Moderate');
    expect(badge.getAttribute('aria-label')).toBe('Air quality: Moderate');
    expect(badge.className).toContain('bg-yellow-200');
    expect(badge.className).toContain('dark:bg-yellow-400/35');
    expect(badge.className).toContain('text-yellow-950');
    expect(badge.querySelector('span')?.className).toContain('bg-yellow-700');
    expect(badge.querySelector('span')?.className).toContain('dark:bg-yellow-300');
    expect(screen.queryByText('27 µg/m³')).not.toBeNull();
    expect(within(screen.getByTestId('weather-current-stats')).queryByTestId('air-quality-badge')).toBeNull();
  });

  it('uses the published PM2.5 category breakpoints', () => {
    expect(getAirQualityStatus(9)?.label).toBe('Good');
    expect(getAirQualityStatus(9.1)?.label).toBe('Moderate');
    expect(getAirQualityStatus(35.5)?.label).toBe('Unhealthy for Sensitive Groups');
    expect(getAirQualityStatus(55.5)?.label).toBe('Unhealthy');
    expect(getAirQualityStatus(125.5)?.label).toBe('Very Unhealthy');
    expect(getAirQualityStatus(225.5)?.label).toBe('Hazardous');
  });
});

// ===========================================================================
// 5. showForecast prop
// ===========================================================================

describe('showForecast prop', () => {
  it('renders the forecast section by default', () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('3-Day Forecast')).not.toBeNull();
    expect(screen.queryByText(/Next 9 Hours/)).not.toBeNull();
  });

  it('hides the forecast section when showForecast=false', () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} showForecast={false} />);

    expect(screen.queryByText('5-Day Forecast')).toBeNull();
    expect(screen.queryByText(/Next .* Hours/)).toBeNull();
  });
});

// ===========================================================================
// 6. Loading and error states
// ===========================================================================

describe('loading and error states', () => {
  it('renders the loading state when loading=true', () => {
    render(<WeatherWidget loading />);
    expect(screen.queryByTestId('loading-state')).not.toBeNull();
  });

  it('renders the error message when error is provided', () => {
    render(<WeatherWidget error="Weather service unavailable" />);
    expect(screen.queryByText('Weather service unavailable')).not.toBeNull();
  });

  it('renders the widget content when neither loading nor error', () => {
    render(<WeatherWidget data={makeWeatherData()} />);
    expect(screen.queryByTestId('widget-container')).not.toBeNull();
  });
});

// ===========================================================================
// 7. Demo data fallback
// ===========================================================================

describe('demo data fallback', () => {
  it('renders without errors when no data prop is provided', () => {
    expect(() => render(<WeatherWidget />)).not.toThrow();
  });

  it('renders the hourly timeline with demo data', () => {
    const { container } = render(<WeatherWidget />);
    expect(screen.queryByText(/Next .* Hours/)).not.toBeNull();
    expect(container.querySelector('[data-keep-bg]')).not.toBeNull();
  });
});

// ===========================================================================
// 8. Sun and moon day rollover
// ===========================================================================

describe('sun and moon day rollover', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('recalculates the celestial paths after local midnight without a remount', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 17, 23, 59, 59, 900));

    const getTimes = jest.spyOn(SunCalc, 'getTimes');
    const sunrise = new Date(2026, 6, 17, 5, 30);
    const sunset = new Date(2026, 6, 17, 20, 15);

    render(<WeatherWidget data={makeWeatherData({ sunrise, sunset, lat: 42.46, lon: -71.06 })} />);

    const initialDay = getTimes.mock.calls.at(-1)?.[0];
    expect(initialDay).toEqual(new Date(2026, 6, 17, 0, 0, 0, 0));

    act(() => {
      jest.advanceTimersByTime(200);
    });

    const rolledDay = getTimes.mock.calls.at(-1)?.[0];
    expect(rolledDay).toEqual(new Date(2026, 6, 18, 0, 0, 0, 0));
  });

  it('uses the weather temperature ramp for sun and moon arc colors', () => {
    const sunrise = new Date(2026, 6, 17, 5, 30);
    const sunset = new Date(2026, 6, 17, 20, 15);
    const { container } = render(
      <WeatherWidget
        data={makeWeatherData({
          sunrise,
          sunset,
          moonrise: new Date(2026, 6, 17, 21, 0),
          moonset: new Date(2026, 6, 18, 5, 0),
          moonPhase: 0.5,
          lat: 42.46,
          lon: -71.06,
        })}
      />
    );

    const gradientStops = Array.from(container.querySelectorAll('linearGradient stop'));
    expect(gradientStops.map((stop) => stop.getAttribute('stop-color'))).toEqual([
      'hsl(var(--weather-temp-very-hot))',
      'hsl(var(--weather-temp-hot))',
      'hsl(var(--weather-temp-warm))',
    ]);

    const moonArc = container.querySelector('path[stroke="hsl(var(--weather-temp-freezing))"]');
    expect(moonArc).not.toBeNull();
  });
});
