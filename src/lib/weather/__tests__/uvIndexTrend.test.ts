import { getUvIndexTrend, UV_INDEX_TREND_WINDOW_MS } from '../uvIndexTrend';

const NOW = new Date('2026-08-11T12:00:00Z').getTime();

function point(minutesFromNow: number, uvIndex: number) {
  return {
    time: new Date(NOW + minutesFromNow * 60 * 1000),
    uvIndex,
  };
}

describe('getUvIndexTrend', () => {
  it('reports rising when the next forecast point is higher', () => {
    expect(getUvIndexTrend(6.5, [point(60, 7)], NOW)).toBe('rising');
  });

  it('reports falling when the next forecast point is lower', () => {
    expect(getUvIndexTrend(6.5, [point(60, 5.5)], NOW)).toBe('falling');
  });

  it('suppresses a change that would not change the displayed index', () => {
    expect(getUvIndexTrend(6.54, [point(60, 6.549)], NOW)).toBeNull();
  });

  it('uses the nearest future point and ignores points outside the window', () => {
    expect(getUvIndexTrend(6.5, [point(80, 5.5), point(30, 7)], NOW)).toBe('rising');
    expect(getUvIndexTrend(6.5, [point(-30, 5.5)], NOW)).toBeNull();
    expect(getUvIndexTrend(6.5, [point(91, 7)], NOW)).toBeNull();
    expect(getUvIndexTrend(6.5, [point(90, 7)], NOW)).toBe('rising');
    expect(UV_INDEX_TREND_WINDOW_MS).toBe(90 * 60 * 1000);
  });

  it('returns no trend for missing or invalid data', () => {
    expect(getUvIndexTrend(6.5, undefined, NOW)).toBeNull();
    expect(getUvIndexTrend(-1, [point(60, 7)], NOW)).toBeNull();
    expect(getUvIndexTrend(Number.NaN, [point(60, 7)], NOW)).toBeNull();
  });
});
