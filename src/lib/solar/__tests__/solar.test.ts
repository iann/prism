import * as SunCalc from 'suncalc';
import {
  DAY_MS,
  geometricAltitude,
  getSolarDay,
  getSubsolarPoint,
  nightHalfWidth,
  nightPath,
  project,
  seasonInstant,
  skyPath,
  skyPoint,
  solarDayKey,
  solarElevation,
  unproject,
  validCoordinates,
  wrapLongitude,
} from '../solar';

describe('global solar geometry', () => {
  it.each(['2026-03-20T12:00Z', '2026-06-21T00:00Z', '2026-09-23T06:00Z', '2026-12-21T18:00Z'])(
    'agrees with the local SunCalc ephemeris everywhere on %s',
    (instant) => {
      const date = new Date(instant);
      const subsolar = getSubsolarPoint(date);
      expect(solarElevation(subsolar, subsolar)).toBeCloseTo(90, 5);
      expect(
        solarElevation({ lat: -subsolar.lat, lon: wrapLongitude(subsolar.lon + 180) }, subsolar)
      ).toBeCloseTo(-90, 5);
      expect(SunCalc.getPosition(date, subsolar.lat, subsolar.lon).altitude).toBeCloseTo(90, 2);
      for (const lat of [-90, -66, -20, 0, 45, 66, 90]) {
        for (const lon of [-180, -90, 0, 90, 180]) {
          const expected = geometricAltitude(SunCalc.getPosition(date, lat, lon).altitude);
          expect(solarElevation({ lat, lon }, subsolar)).toBeCloseTo(expected, 6);
        }
      }
    }
  );

  it('places the subsolar latitude on the correct tropic at each solstice', () => {
    expect(getSubsolarPoint(new Date('2026-06-21T12:00Z')).lat).toBeCloseTo(23.44, 1);
    expect(getSubsolarPoint(new Date('2026-12-21T12:00Z')).lat).toBeCloseTo(-23.44, 1);
  });

  it('has finite, nested twilight boundaries at the equinox and both poles', () => {
    for (const lat of [-90, -80, -45, 0, 45, 80, 90]) {
      for (const declination of [-23.44, 0, 23.44]) {
        let previous = 180;
        for (const threshold of [0, -6, -12, -18]) {
          const width = nightHalfWidth(lat, declination, threshold);
          expect(width).toBeGreaterThanOrEqual(0);
          expect(width).toBeLessThanOrEqual(previous);
          previous = width;
          // For partial darkness, the edge lies exactly on the requested altitude.
          if (width > 0 && width < 180) {
            expect(
              solarElevation({ lat, lon: 180 - width }, { lat: declination, lon: 0 })
            ).toBeCloseTo(threshold, 5);
          }
          expect(nightPath({ lat: declination, lon: 180 }, threshold)).not.toMatch(/NaN|Infinity/);
        }
      }
    }
    expect(nightHalfWidth(0, 0)).toBeCloseTo(90);
    expect(nightHalfWidth(90, 23.44)).toBe(0);
    expect(nightHalfWidth(-90, 23.44)).toBe(180);
  });

  it('does not draw artificial polar closure lines as part of the terminator', () => {
    const outline = nightPath({ lat: 23.44, lon: 0 }, 0, true);
    expect(outline).not.toContain('Z');
    expect(outline).not.toMatch(/,0\.00|,400\.00/);
    expect(outline.match(/M/g)).toHaveLength(2);
  });

  it('projects the whole world to a 5:2 Lambert equal-area map', () => {
    expect(project({ lat: 0, lon: 0 })).toEqual({ x: 500, y: 200 });
    expect(project({ lat: 30, lon: 0 }).y).toBeCloseTo(100, 5);
    expect(project({ lat: 90, lon: 0 }).y).toBeCloseTo(0, 8);
    expect(project({ lat: -90, lon: 0 }).y).toBeCloseTo(400, 8);
  });

  it('round-trips coordinates at the poles and date line', () => {
    for (const location of [
      { lat: 90, lon: 180 },
      { lat: -90, lon: -180 },
      { lat: 42.36, lon: -71.06 },
    ]) {
      const point = project(location);
      const actual = unproject(point.x, point.y);
      expect(actual.lat).toBeCloseTo(location.lat);
      expect(actual.lon).toBeCloseTo(location.lon);
    }
    expect(validCoordinates(NaN, 0)).toBe(false);
    expect(validCoordinates(0, Infinity)).toBe(false);
    expect(validCoordinates(91, 181)).toBe(false);
  });
});

describe('local solar day and sky', () => {
  it('uses the location’s day across the date line regardless of browser timezone', () => {
    const time = Date.parse('2026-03-20T18:00Z');
    expect(solarDayKey(time, 179)).toBe('2026-03-21');
    expect(solarDayKey(time, -179)).toBe('2026-03-20');
    const east = getSolarDay('2026-03-21', { lat: 0, lon: 179 });
    const west = getSolarDay('2026-03-20', { lat: 0, lon: -179 });
    expect(Math.abs(east.noon - west.noon)).toBeLessThan(10 * 60_000);
  });

  it('includes exact rise, noon, and set instants and has a seasonal peak on a fixed scale', () => {
    const location = { lat: 42.36, lon: -71.06 };
    const summer = getSolarDay('2026-06-21', location);
    const winter = getSolarDay('2026-12-21', location);
    expect(summer.dayLength / 3_600_000).toBeCloseTo(15.3, 1);
    expect(winter.dayLength / 3_600_000).toBeCloseTo(9.1, 1);
    expect(summer.maxElevation).toBeCloseTo(71.1, 1);
    expect(winter.maxElevation).toBeCloseTo(24.2, 1);
    for (const time of [summer.start, summer.noon, summer.end])
      expect(summer.samples.some((sample) => sample.time === time)).toBe(true);
    expect(skyPoint({ altitude: 45, azimuth: 180 }, 180).y).toBe(585);
    expect(skyPoint({ altitude: 90, azimuth: 180 }, 180).y).toBe(530);
  });

  it.each([90, 78.2, -78.2, -90])('handles polar day and night at latitude %s', (lat) => {
    const summer = getSolarDay(lat > 0 ? '2026-06-21' : '2026-12-21', { lat, lon: 15 });
    const winter = getSolarDay(lat > 0 ? '2026-12-21' : '2026-06-21', { lat, lon: 15 });
    expect(summer.times.sunrise).toBeNull();
    expect(summer.times.alwaysUp).toBe(true);
    expect(summer.dayLength).toBe(DAY_MS);
    expect(winter.times.sunset).toBeNull();
    expect(winter.times.alwaysDown).toBe(true);
    expect(winter.dayLength).toBe(0);
    expect(skyPath(summer.samples, summer.noonAzimuth)).not.toMatch(/NaN|Infinity/);
    expect(skyPath(winter.samples, winter.noonAzimuth)).not.toMatch(/NaN|Infinity/);
  });

  it('breaks paths at the azimuth seam instead of drawing across the sky', () => {
    const path = skyPath(
      [
        { time: 0, azimuth: 359, altitude: -20 },
        { time: 1, azimuth: 1, altitude: -20 },
      ],
      180
    );
    expect(path.match(/M/g)).toHaveLength(2);
  });

  it('finds astronomical seasons in the selected year and swaps hemispheres', () => {
    const spring = seasonInstant(2026, 'spring', false);
    expect(spring.toISOString().slice(0, 10)).toBe('2026-03-20');
    expect(Math.abs(getSubsolarPoint(spring).lat)).toBeLessThan(0.0001);
    expect(seasonInstant(2026, 'summer', false).toISOString().slice(0, 10)).toBe('2026-06-21');
    expect(seasonInstant(2026, 'summer', true).toISOString().slice(0, 10)).toBe('2026-12-21');
    expect(seasonInstant(2028, 'fall', false).getUTCFullYear()).toBe(2028);
  });
});
