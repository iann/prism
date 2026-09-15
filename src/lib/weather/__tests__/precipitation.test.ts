import type { HourlyForecast, MinutelyData, WeatherData } from '@/components/widgets/WeatherWidget';
import { hasPrecipitationInRadarWindow, isPrecipitatingCondition } from '../precipitation';

const NOW = Date.UTC(2026, 8, 1, 15, 0, 0);
const UNITS = {
  temperature: 'F' as const,
  windSpeed: 'mph' as const,
  precipitation: 'mm' as const,
};

function hourly(overrides: Partial<HourlyForecast> = {}): HourlyForecast {
  return {
    time: new Date(NOW),
    condition: 'sunny',
    temp: 70,
    feelsLike: 70,
    ...overrides,
  };
}

function minute(overrides: Partial<MinutelyData> = {}): MinutelyData {
  return {
    time: NOW / 1000,
    precipIntensity: 0,
    precipProbability: 0,
    ...overrides,
  };
}

function weather(overrides: Partial<Pick<WeatherData, 'current' | 'hourly' | 'minutely'>> = {}) {
  return {
    current: {
      temperature: 70,
      feelsLike: 70,
      condition: 'sunny' as const,
      humidity: 50,
      windSpeed: 5,
      description: 'Clear sky',
    },
    units: UNITS,
    hourly: [],
    ...overrides,
  };
}

describe('precipitation radar window', () => {
  it.each(['rainy', 'snowy', 'stormy'] as const)('recognizes %s as precipitation', (condition) => {
    expect(isPrecipitatingCondition(condition)).toBe(true);
  });

  it('shows the radar for active precipitation', () => {
    expect(
      hasPrecipitationInRadarWindow(
        weather({ current: { ...weather().current, condition: 'rainy' } }),
        NOW
      )
    ).toBe(true);
  });

  it('shows the radar for measurable precipitation during the previous two hours', () => {
    expect(
      hasPrecipitationInRadarWindow(
        weather({
          hourly: [
            hourly({
              time: new Date(NOW - 90 * 60 * 1000),
              condition: 'cloudy',
              precipIntensity: 0.2,
            }),
          ],
        }),
        NOW
      )
    ).toBe(true);
  });

  it('ignores precipitation outside the two-hour lookback/lookahead', () => {
    expect(
      hasPrecipitationInRadarWindow(
        weather({
          hourly: [
            hourly({ time: new Date(NOW - 2 * 60 * 60 * 1000 - 1), condition: 'rainy' }),
            hourly({ time: new Date(NOW + 2 * 60 * 60 * 1000 + 1), condition: 'snowy' }),
          ],
        }),
        NOW
      )
    ).toBe(false);
  });

  it('shows the radar for precipitation expected in the next two hours', () => {
    expect(
      hasPrecipitationInRadarWindow(
        weather({
          hourly: [
            hourly({
              time: new Date(NOW + 2 * 60 * 60 * 1000),
              condition: 'snowy',
            }),
          ],
        }),
        NOW
      )
    ).toBe(true);
  });

  it('uses a meaningful future precipitation probability when amount is unavailable', () => {
    expect(
      hasPrecipitationInRadarWindow(
        weather({
          hourly: [
            hourly({
              time: new Date(NOW + 60 * 60 * 1000),
              condition: 'cloudy',
              precipProbability: 50,
            }),
          ],
        }),
        NOW
      )
    ).toBe(true);
  });

  it('uses minutely precipitation signals when available', () => {
    expect(
      hasPrecipitationInRadarWindow(
        weather({
          minutely: [
            minute({
              time: (NOW + 30 * 60 * 1000) / 1000,
              precipProbability: 0.8,
            }),
          ],
        }),
        NOW
      )
    ).toBe(true);
  });
});
