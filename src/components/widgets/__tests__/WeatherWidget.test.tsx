/**
 * @jest-environment jsdom
 *
 * Tests for WeatherWidget — covering the hourly timeline, the day
 * summary header, the forecastDays prop, current conditions, and loading /
 * error / fallback states.
 */

import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import SunCalc from 'suncalc';

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

import { WeatherWidget } from '../WeatherWidget';
import type { WeatherData, ForecastDay, HourlyForecast, WeatherCondition } from '../WeatherWidget';

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
  temp = 70
): HourlyForecast[] {
  const conditions: WeatherCondition[] = Array.isArray(conditionOrList)
    ? conditionOrList
    : Array(24).fill(conditionOrList);

  // Anchor to the top of the current hour
  const base = new Date();
  base.setMinutes(0, 0, 0);

  return Array.from({ length: 24 }, (_, i) => ({
    time: new Date(base.getTime() + i * 60 * 60_000),
    condition: conditions[i] ?? 'sunny',
    temp,
  }));
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

  it('renders the weather description', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, description: 'Heavy thunderstorm' },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('Heavy thunderstorm')).not.toBeNull();
  });

  it('renders the location at the bottom of the right-side stats', () => {
    const data = makeWeatherData({ location: 'Denver, Colorado, US 80202' });
    render(<WeatherWidget data={data} />);
    const stats = within(screen.getByTestId('weather-current-stats'));
    expect(stats.queryByText('Denver, CO')).not.toBeNull();
    expect(stats.queryByText('80202')).toBeNull();
  });

  it('places the condition in the right-side stats', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, description: 'Partly cloudy' },
    });
    render(<WeatherWidget data={data} />);

    expect(within(screen.getByTestId('weather-current-stats')).queryByText('Partly cloudy')).not.toBeNull();
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
