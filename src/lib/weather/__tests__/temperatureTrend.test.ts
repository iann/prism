import { getTemperatureTrend, TEMPERATURE_TREND_WINDOW_MS } from '../temperatureTrend';

const NOW = new Date('2026-08-11T12:00:00Z').getTime();

function point(minutesFromNow: number, temp: number, feelsLike = temp) {
  return {
    time: new Date(NOW + minutesFromNow * 60 * 1000),
    temp,
    feelsLike,
  };
}

describe('getTemperatureTrend', () => {
  it('reports rising when consecutive future forecast points get warmer', () => {
    expect(getTemperatureTrend([point(60, 72), point(120, 74)], NOW)).toBe('rising');
  });

  it('reports falling when consecutive future forecast points get cooler', () => {
    expect(getTemperatureTrend([point(60, 72), point(120, 70)], NOW)).toBe('falling');
  });

  it('reports a trend only when actual and feels-like temperatures agree', () => {
    expect(getTemperatureTrend([point(60, 72, 68), point(120, 74, 70)], NOW)).toBe('rising');
    expect(getTemperatureTrend([point(60, 72, 68), point(120, 70, 66)], NOW)).toBe('falling');
    expect(getTemperatureTrend([point(60, 72, 68), point(120, 74, 66)], NOW)).toBeNull();
  });

  it('omits the trend when either series is steady at display precision', () => {
    expect(getTemperatureTrend([point(60, 72, 68), point(120, 74, 68.4)], NOW)).toBeNull();
  });

  it('uses only future forecast samples, not the active timeline reading', () => {
    expect(getTemperatureTrend([point(-30, 90), point(60, 70), point(120, 72)], NOW)).toBe(
      'rising'
    );
  });

  it('suppresses a change that would not change the displayed temperature', () => {
    expect(getTemperatureTrend([point(60, 72.4), point(120, 72.49)], NOW)).toBeNull();
  });

  it('uses the nearest two future points in an unsorted forecast', () => {
    expect(getTemperatureTrend([point(240, 71), point(120, 73), point(30, 72)], NOW)).toBe(
      'rising'
    );
  });

  it('ignores past points and points beyond the near-term window', () => {
    expect(getTemperatureTrend([point(-30, 70), point(60, 72)], NOW)).toBeNull();
    expect(getTemperatureTrend([point(60, 70), point(361, 72)], NOW)).toBeNull();
    expect(getTemperatureTrend([point(60, 70), point(360, 72)], NOW)).toBe('rising');
    expect(TEMPERATURE_TREND_WINDOW_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('returns no trend when there is no forecast', () => {
    expect(getTemperatureTrend(undefined, NOW)).toBeNull();
  });
});
