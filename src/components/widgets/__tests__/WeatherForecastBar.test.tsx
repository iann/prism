/** @jest-environment jsdom */

import React from 'react';
import { render } from '@testing-library/react';
import { applyAppTheme, appThemes } from '@/lib/themes/appThemes';
import { DayHeader } from '../WeatherForecastBar';
import type { ForecastDay } from '../WeatherWidget';

const units = {
  temperature: 'F' as const,
  windSpeed: 'mph' as const,
  precipitation: 'in' as const,
};

const weatherRangeStops = [
  '--weather-temp-very-cold',
  '--weather-temp-freezing',
  '--weather-temp-cold',
  '--weather-temp-cool',
  '--weather-temp-mild',
  '--weather-temp-warm',
  '--weather-temp-hot',
  '--weather-temp-very-hot',
] as const;

function makeDay(overrides: Partial<ForecastDay> = {}): ForecastDay {
  return {
    date: new Date(Date.now() + 86_400_000),
    dayName: 'Tue',
    high: 88,
    low: 32,
    condition: 'sunny',
    ...overrides,
  };
}

describe.each([
  ['light', 'kitchen-calm'],
  ['dark', 'kitchen-calm'],
] as const)('weather range colors in %s mode', (variant, themeId) => {
  beforeEach(() => {
    applyAppTheme(themeId, variant);
  });

  it('uses the active theme ramp and the thicker range treatment', () => {
    const { container } = render(<DayHeader days={[makeDay()]} units={units} />);
    const range = container.querySelector('[data-weather-temperature-range]');

    expect(range).not.toBeNull();
    expect(range?.className).toContain('h-3');
    expect(range?.className).not.toContain('opacity-80');
    expect(range?.getAttribute('style')).toContain('--weather-temp-freezing');
    expect(range?.getAttribute('style')).toContain('--weather-temp-hot');
    expect(range?.getAttribute('style')).toContain('saturate(1.18)');
  });
});

describe('weather temperature theme tokens', () => {
  it('defines a complete, mode-aware ramp for every named theme', () => {
    for (const theme of Object.values(appThemes)) {
      for (const variant of ['light', 'dark'] as const) {
        for (const stop of weatherRangeStops) {
          expect(theme[variant][stop]).toBeTruthy();
        }
      }
    }

    expect(appThemes['kitchen-calm'].light['--weather-temp-very-cold']).not.toBe(
      appThemes['kitchen-calm'].dark['--weather-temp-very-cold']
    );
    expect(appThemes['kitchen-calm'].light['--weather-temp-cool']).not.toBe(
      appThemes['warm-clay'].light['--weather-temp-cool']
    );
  });
});
