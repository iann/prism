import { getNextSolarTransition, resolveSunsetTheme } from '../sunsetTheme';

const BOSTON = { lat: 42.46, lon: -71.06 };

describe('sunset theme timing', () => {
  it('resolves light during the day and dark after sunset', () => {
    expect(resolveSunsetTheme(new Date('2026-07-17T16:00:00.000Z'), BOSTON)).toBe('light');
    expect(resolveSunsetTheme(new Date('2026-07-18T03:00:00.000Z'), BOSTON)).toBe('dark');
  });

  it('finds the next sunrise or sunset for timer scheduling', () => {
    const now = new Date('2026-07-17T16:00:00.000Z');
    const next = getNextSolarTransition(now, BOSTON);

    expect(next).toBeInstanceOf(Date);
    expect(next!.getTime()).toBeGreaterThan(now.getTime());
  });

  it('falls back to a supplied sunset when coordinates are unavailable', () => {
    const sunset = new Date('2026-07-17T20:00:00.000Z');

    expect(resolveSunsetTheme(new Date('2026-07-17T19:59:00.000Z'), undefined, sunset)).toBe(
      'light'
    );
    expect(resolveSunsetTheme(new Date('2026-07-17T20:01:00.000Z'), undefined, sunset)).toBe(
      'dark'
    );
    expect(resolveSunsetTheme(new Date('2026-07-17T20:01:00.000Z'))).toBeNull();
  });
});
