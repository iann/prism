import { getTemperatureTrend, TEMPERATURE_TREND_WINDOW_MS } from '../temperatureTrend';

const NOW = new Date('2026-08-11T12:00:00Z').getTime();

function point(minutesFromNow: number, temp: number) {
  return {
    time: new Date(NOW + minutesFromNow * 60 * 1000),
    temp,
  };
}

describe('getTemperatureTrend', () => {
  it('reports rising when the next forecast point is warmer', () => {
    expect(getTemperatureTrend(72, [point(60, 74)], NOW)).toBe('rising');
  });

  it('reports falling when the next forecast point is cooler', () => {
    expect(getTemperatureTrend(72, [point(60, 70)], NOW)).toBe('falling');
  });

  it('suppresses a change that would not change the displayed temperature', () => {
    expect(getTemperatureTrend(72.4, [point(60, 72.49)], NOW)).toBeNull();
  });

  it('uses the nearest future point in an unsorted forecast', () => {
    expect(getTemperatureTrend(72, [point(80, 71), point(30, 73)], NOW)).toBe('rising');
  });

  it('ignores past points and points beyond the near-term window', () => {
    expect(getTemperatureTrend(72, [point(-30, 70)], NOW)).toBeNull();
    expect(getTemperatureTrend(72, [point(91, 70)], NOW)).toBeNull();
    expect(getTemperatureTrend(72, [point(90, 70)], NOW)).toBe('falling');
    expect(TEMPERATURE_TREND_WINDOW_MS).toBe(90 * 60 * 1000);
  });

  it('returns no trend when there is no forecast', () => {
    expect(getTemperatureTrend(72, undefined, NOW)).toBeNull();
  });
});
