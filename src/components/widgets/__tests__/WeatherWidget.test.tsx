/**
 * @jest-environment jsdom
 *
 * Tests for WeatherWidget — covering the homegrown HourlyTimeline,
 * the day summary header, forecastDays prop, condition color mapping,
 * hour label rendering, and current conditions.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';

// --- mocks (must precede component import) ---------------------------------

// jsdom doesn't implement ResizeObserver; stub it so components that use it
// (SunriseSunsetArc, PrecipitationChart) don't throw in tests.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

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
    if (error)   return <div data-testid="error-state">{error}</div>;
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

function makeForecastDay(overrides: Partial<ForecastDay> = {}): ForecastDay {
  return {
    date: new Date('2026-04-07T00:00:00.000Z'),
    dayName: 'Tue',
    high: 72,
    low: 55,
    condition: 'sunny',
    ...overrides,
  };
}

/**
 * Build 24 hourly items anchored to a fixed local midnight so time labels
 * are deterministic regardless of when the test runs.
 *   hour 0  → '12am'
 *   hour 1  → '1am'
 *   hour 12 → '12pm'
 *   hour 14 → '2pm'
 */
function makeHourlyForecast(
  conditionOrList: WeatherCondition | WeatherCondition[] = 'sunny',
  temp = 70,
): HourlyForecast[] {
  const conditions: WeatherCondition[] = Array.isArray(conditionOrList)
    ? conditionOrList
    : Array(24).fill(conditionOrList);

  return Array.from({ length: 24 }, (_, i) => ({
    // new Date(year, month, day, hour) — local time, deterministic labels
    time:      new Date(2026, 3, 7, i),   // April 7, 2026, hour i
    condition: conditions[i] ?? 'sunny',
    temp,
  }));
}

/** Build a full WeatherData object. */
function makeWeatherData(overrides: Partial<WeatherData> = {}): WeatherData {
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const forecast: ForecastDay[] = DAY_NAMES.slice(0, 5).map((dayName, i) => ({
    date: new Date(Date.UTC(2026, 3, 7 + i)),
    dayName,
    high: 70 + i,
    low:  50 + i,
    condition: 'sunny' as WeatherCondition,
  }));

  return {
    location: 'Chicago, IL',
    current: {
      temperature: 68,
      feelsLike:   65,
      condition:   'sunny',
      humidity:    45,
      windSpeed:   10,
      description: 'Clear sky',
    },
    forecast,
    hourly: makeHourlyForecast('sunny'),
    lastUpdated: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------


// ===========================================================================
// 1. HourlyTimeline rendering
// ===========================================================================

describe('HourlyTimeline rendering', () => {
  it('renders the "Next 12 Hours" label when hourly data is present', () => {
    render(<WeatherWidget data={makeWeatherData()} />);
    expect(screen.queryByText('Next 12 Hours')).not.toBeNull();
  });

  it('does not render when hourly data is empty', () => {
    render(<WeatherWidget data={makeWeatherData({ hourly: [] })} />);
    expect(screen.queryByText('Next 12 Hours')).toBeNull();
  });

  it('does not render when showForecast is false', () => {
    render(<WeatherWidget data={makeWeatherData()} showForecast={false} />);
    expect(screen.queryByText('Next 12 Hours')).toBeNull();
  });

  it('re-renders segments when hourly data changes', () => {
    const data = makeWeatherData({ hourly: makeHourlyForecast('sunny') });
    const { rerender, container } = render(<WeatherWidget data={data} />);

    const before = container.querySelectorAll('[data-testid="timeline-segment"]').length;

    const mixed: WeatherCondition[] = [...Array(6).fill('sunny'), ...Array(6).fill('rainy')];
    const updated = makeWeatherData({ hourly: makeHourlyForecast(mixed) });
    rerender(<WeatherWidget data={updated} />);

    const after = container.querySelectorAll('[data-testid="timeline-segment"]').length;
    expect(after).toBeGreaterThan(before);
  });
});


// ===========================================================================
// 2. Timeline segment merging
// ===========================================================================

describe('timeline segment merging', () => {
  it('renders 1 segment when all 12 hours share the same condition', () => {
    const data = makeWeatherData({ hourly: makeHourlyForecast('sunny') });
    const { container } = render(<WeatherWidget data={data} />);
    const segments = container.querySelectorAll('[data-testid="timeline-segment"]');
    expect(segments.length).toBe(1);
  });

  it('renders 2 segments when condition changes once at the midpoint', () => {
    const conditions: WeatherCondition[] = [
      ...Array(6).fill('sunny'),
      ...Array(6).fill('rainy'),
    ];
    const data = makeWeatherData({ hourly: makeHourlyForecast(conditions) });
    const { container } = render(<WeatherWidget data={data} />);
    const segments = container.querySelectorAll('[data-testid="timeline-segment"]');
    expect(segments.length).toBe(2);
  });

  it('renders up to 12 segments when every hour is a different condition', () => {
    const conditions: WeatherCondition[] = [
      'sunny', 'rainy', 'sunny', 'rainy', 'sunny', 'rainy',
      'sunny', 'rainy', 'sunny', 'rainy', 'sunny', 'rainy',
    ];
    const data = makeWeatherData({ hourly: makeHourlyForecast(conditions) });
    const { container } = render(<WeatherWidget data={data} />);
    const segments = container.querySelectorAll('[data-testid="timeline-segment"]');
    expect(segments.length).toBe(12);
  });

  it('merges non-consecutive same-condition hours into separate segments', () => {
    // sunny x6, rainy x3, sunny x3 → 3 segments (not merged into 2)
    const conditions: WeatherCondition[] = [
      ...Array(6).fill('sunny'),
      ...Array(3).fill('rainy'),
      ...Array(3).fill('sunny'),
    ];
    const data = makeWeatherData({ hourly: makeHourlyForecast(conditions) });
    const { container } = render(<WeatherWidget data={data} />);
    const segments = container.querySelectorAll('[data-testid="timeline-segment"]');
    expect(segments.length).toBe(3);
  });

  it('uses only the first 12 hours even when more are provided', () => {
    // All 24 hours the same condition → still 1 segment
    const data = makeWeatherData({ hourly: makeHourlyForecast('cloudy') });
    const { container } = render(<WeatherWidget data={data} />);
    const segments = container.querySelectorAll('[data-testid="timeline-segment"]');
    expect(segments.length).toBe(1);
  });
});


// ===========================================================================
// 3. Condition color rendering
// ===========================================================================

describe('condition → segment background color', () => {
  // jsdom normalises hex to rgb(r, g, b)
  const EXPECTED_COLORS: [WeatherCondition, string][] = [
    ['sunny',         'rgb(234, 236, 240)'],  // #EAECF0
    ['partly-cloudy', 'rgb(200, 203, 214)'],  // #C8CBD6
    ['cloudy',        'rgb(168, 173, 184)'],  // #A8ADB8
    ['rainy',         'rgb(123, 158, 199)'],  // #7B9EC7
    ['snowy',         'rgb(184, 212, 232)'],  // #B8D4E8
    ['stormy',        'rgb(74, 111, 165)'],   // #4A6FA5
  ];

  it.each(EXPECTED_COLORS)(
    'condition "%s" renders segment with background %s',
    (condition, expectedRgb) => {
      const data = makeWeatherData({ hourly: makeHourlyForecast(condition) });
      const { container } = render(<WeatherWidget data={data} />);
      const segment = container.querySelector<HTMLElement>('[data-testid="timeline-segment"]');
      expect(segment).not.toBeNull();
      expect(segment!.style.backgroundColor).toBe(expectedRgb);
    }
  );
});


// ===========================================================================
// 4. Day summary header (driven by forecastDays, not the timeline)
// ===========================================================================

describe('day summary header', () => {
  it('renders a label for each forecast day', () => {
    const data = makeWeatherData({
      forecast: [
        makeForecastDay({ dayName: 'Mon' }),
        makeForecastDay({ dayName: 'Tue', date: new Date(Date.UTC(2026, 3, 8)) }),
        makeForecastDay({ dayName: 'Wed', date: new Date(Date.UTC(2026, 3, 9)) }),
      ],
    });
    render(<WeatherWidget data={data} forecastDays={3} />);

    // Day names are rendered as uppercase in the DOM (dayName.toUpperCase())
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
    expect(screen.queryByText(/88°/)).not.toBeNull();
  });

  it('shows the low temperature for each day in °F', () => {
    const data = makeWeatherData({
      forecast: [makeForecastDay({ dayName: 'Mon', high: 72, low: 44 })],
    });
    render(<WeatherWidget data={data} forecastDays={1} />);
    expect(screen.queryByText(/44°/)).not.toBeNull();
  });

  it('converts temperatures to Celsius when useCelsius=true', () => {
    // 95°F → 35°C, 50°F → 10°C
    const data = makeWeatherData({
      forecast: [makeForecastDay({ high: 95, low: 50 })],
    });
    render(<WeatherWidget data={data} forecastDays={1} useCelsius />);
    expect(screen.queryByText(/35°/)).not.toBeNull();
    expect(screen.queryByText(/10°/)).not.toBeNull();
  });

  it('renders an icon for each day in the header', () => {
    const data = makeWeatherData();
    const { container } = render(<WeatherWidget data={data} forecastDays={3} />);

    const svgs = container.querySelectorAll('svg');
    // At minimum: 1 current-conditions icon + 3 day header icons
    expect(svgs.length).toBeGreaterThanOrEqual(4);
  });
});


// ===========================================================================
// 5. forecastDays prop — controls the day summary; not the timeline
// ===========================================================================

describe('forecastDays prop', () => {
  it('defaults to 5 when not specified and 5+ days are available', () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('5-Day Forecast')).not.toBeNull();
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
        makeForecastDay({ dayName: 'Tue', date: new Date(Date.UTC(2026, 3, 8)) }),
      ],
    });
    render(<WeatherWidget data={data} forecastDays={5} />);

    // Label reflects the requested prop
    expect(screen.queryByText('5-Day Forecast')).not.toBeNull();
    // Header shows only the 2 days that exist
    expect(screen.queryByText('MON')).not.toBeNull();
    expect(screen.queryByText('TUE')).not.toBeNull();
    expect(screen.queryByText('WED')).toBeNull();
  });

});


// ===========================================================================
// 6. Timeline hour labels
// ===========================================================================

describe('timeline hour labels', () => {
  it('shows a label at position 0 (first hour)', () => {
    // makeHourlyForecast starts at hour 0 of April 7, 2026 → "12am"
    const data = makeWeatherData({ hourly: makeHourlyForecast('sunny') });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('12am')).not.toBeNull();
  });

  it('shows labels every 3 hours (positions 0, 3, 6, 9)', () => {
    // April 7 hours 0–11 → labels at 12am, 3am, 6am, 9am
    const data = makeWeatherData({ hourly: makeHourlyForecast('sunny') });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('12am')).not.toBeNull();
    expect(screen.queryByText('3am')).not.toBeNull();
    expect(screen.queryByText('6am')).not.toBeNull();
    expect(screen.queryByText('9am')).not.toBeNull();
  });

  it('does not show a label at position 1 or 2', () => {
    // Hour 1 → "1am", hour 2 → "2am"
    const data = makeWeatherData({ hourly: makeHourlyForecast('sunny') });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('1am')).toBeNull();
    expect(screen.queryByText('2am')).toBeNull();
  });

  it('formats noon correctly as "12pm"', () => {
    // Build hourly starting at hour 12 so the first 12-hour window includes noon
    const hours: HourlyForecast[] = Array.from({ length: 24 }, (_, i) => ({
      time:      new Date(2026, 3, 7, 12 + i),
      condition: 'sunny' as WeatherCondition,
      temp:      70,
    }));
    const data = makeWeatherData({ hourly: hours });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('12pm')).not.toBeNull();
  });

  it('formats 1pm–11pm without leading zero', () => {
    const hours: HourlyForecast[] = Array.from({ length: 24 }, (_, i) => ({
      time:      new Date(2026, 3, 7, 13 + i),
      condition: 'sunny' as WeatherCondition,
      temp:      70,
    }));
    const data = makeWeatherData({ hourly: hours });
    render(<WeatherWidget data={data} />);
    // Hour 13 → "1pm" is at position 0 → shown
    expect(screen.queryByText('1pm')).not.toBeNull();
  });
});


// ===========================================================================
// 7. Current conditions display
// ===========================================================================

describe('current conditions', () => {
  it('renders the current temperature in °F by default', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, temperature: 73 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('73°F')).not.toBeNull();
  });

  it('converts current temperature to °C when useCelsius=true', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, temperature: 32 },
    });
    render(<WeatherWidget data={data} useCelsius />);
    expect(screen.queryByText('0°C')).not.toBeNull();
  });

  it('renders the weather description', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, description: 'Heavy thunderstorm' },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('Heavy thunderstorm')).not.toBeNull();
  });

  it('renders the location name (city only — state is stripped by formatLocation)', () => {
    const data = makeWeatherData({ location: 'Denver, CO' });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('Denver')).not.toBeNull();
  });

  it('renders the "feels like" temperature', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, feelsLike: 60 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText(/Feels like 60°F/)).not.toBeNull();
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
// 8. showForecast prop
// ===========================================================================

describe('showForecast prop', () => {
  it('renders the forecast section by default', () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('5-Day Forecast')).not.toBeNull();
    expect(screen.queryByText('Next 12 Hours')).not.toBeNull();
  });

  it('hides the forecast section when showForecast=false', async () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} showForecast={false} />);
    await act(async () => {});

    expect(screen.queryByText('5-Day Forecast')).toBeNull();
    expect(screen.queryByText('Next 12 Hours')).toBeNull();
  });
});


// ===========================================================================
// 9. Loading and error states
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
// 10. Demo data fallback
// ===========================================================================

describe('demo data fallback', () => {
  it('renders without errors when no data prop is provided', () => {
    expect(() => render(<WeatherWidget />)).not.toThrow();
  });

  it('uses demo location when no location or data is provided', () => {
    render(<WeatherWidget />);
    expect(screen.queryByText('Melrose')).not.toBeNull();
  });

  it('shows the passed location in demo mode', () => {
    render(<WeatherWidget location="Austin, TX" />);
    expect(screen.queryByText('Austin')).not.toBeNull();
  });

  it('renders the Next 12 Hours timeline with demo data', () => {
    render(<WeatherWidget />);
    expect(screen.queryByText('Next 12 Hours')).not.toBeNull();
  });
});
