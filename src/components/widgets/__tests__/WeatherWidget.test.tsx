/**
 * @jest-environment jsdom
 *
 * Tests for WeatherWidget — covering the day summary header, forecastDays prop,
 * current conditions display, sunrise/sunset, loading/error states, and demo data fallback.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// Stub WidgetContainer so we don't pull in next/link, Radix UI, etc.
jest.mock('../WidgetContainer', () => ({
  WidgetContainer: function MockWidgetContainer({
    children,
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
    return <div data-testid="widget-container">{children}</div>;
  },
}));

// Mock ResizeObserver (used by SunriseSunsetArc)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { WeatherWidget } from '../WeatherWidget';
import type { WeatherData, ForecastDay, WeatherCondition } from '../WeatherWidget';

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
    lastUpdated: new Date(),
    ...overrides,
  };
}

// ===========================================================================
// 1. Day summary header
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
// 2. forecastDays prop
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

    expect(screen.queryByText('5-Day Forecast')).not.toBeNull();
    expect(screen.queryByText('MON')).not.toBeNull();
    expect(screen.queryByText('TUE')).not.toBeNull();
    expect(screen.queryByText('WED')).toBeNull();
  });
});


// ===========================================================================
// 3. Current conditions display
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

  it('renders the location string', () => {
    const data = makeWeatherData({ location: 'Denver, CO' });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('Denver, CO')).not.toBeNull();
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
// 4. showForecast prop
// ===========================================================================

describe('showForecast prop', () => {
  it('renders the forecast section by default', () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('5-Day Forecast')).not.toBeNull();
  });

  it('hides the forecast section when showForecast=false', () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} showForecast={false} />);
    expect(screen.queryByText('5-Day Forecast')).toBeNull();
  });
});


// ===========================================================================
// 5. Loading and error states
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
// 6. Demo data fallback
// ===========================================================================

describe('demo data fallback', () => {
  it('renders without errors when no data prop is provided', () => {
    expect(() => render(<WeatherWidget />)).not.toThrow();
  });

  it('renders the default demo location when no props are provided', () => {
    render(<WeatherWidget />);
    expect(screen.queryByText('Melrose, MA')).not.toBeNull();
  });

  it('uses the passed location prop in demo mode', () => {
    render(<WeatherWidget location="Austin, TX" />);
    expect(screen.queryByText('Austin, TX')).not.toBeNull();
  });
});
