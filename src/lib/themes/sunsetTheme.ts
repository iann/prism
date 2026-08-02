import SunCalc from 'suncalc';

export type SolarCoordinates = {
  lat: number;
  lon: number;
};

function hasSolarCoordinates(value: SolarCoordinates | undefined): value is SolarCoordinates {
  return Boolean(
    value &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lon) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    value.lon >= -180 &&
    value.lon <= 180
  );
}

/**
 * Resolve the automatic brightness for a location.
 *
 * The solar position is used instead of comparing the browser's clock with a
 * cached sunset timestamp. That keeps the mode correct across midnight and
 * lets it switch back to light at the next sunrise even while weather data is
 * being refreshed.
 */
export function resolveSunsetTheme(
  now: Date,
  coordinates?: SolarCoordinates,
  fallbackSunset?: Date
): 'light' | 'dark' | null {
  if (hasSolarCoordinates(coordinates)) {
    return SunCalc.getPosition(now, coordinates.lat, coordinates.lon).altitude < 0
      ? 'dark'
      : 'light';
  }

  if (fallbackSunset && Number.isFinite(fallbackSunset.getTime())) {
    return now.getTime() >= fallbackSunset.getTime() ? 'dark' : 'light';
  }

  return null;
}

/**
 * Find the next sunrise or sunset so the theme can update without waiting for
 * the weather polling interval. SunCalc returns Date values in absolute time,
 * so this remains correct across timezone and daylight-saving changes.
 */
export function getNextSolarTransition(now: Date, coordinates?: SolarCoordinates): Date | null {
  if (!hasSolarCoordinates(coordinates)) return null;

  const candidates: Date[] = [];
  const dayMs = 24 * 60 * 60 * 1000;

  for (let day = 0; day <= 2; day += 1) {
    const times = SunCalc.getTimes(
      new Date(now.getTime() + day * dayMs),
      coordinates.lat,
      coordinates.lon
    );
    for (const transition of [times.sunrise, times.sunset]) {
      if (transition instanceof Date && transition.getTime() > now.getTime()) {
        candidates.push(transition);
      }
    }
  }

  return candidates.length > 0
    ? candidates.reduce((soonest, candidate) =>
        candidate.getTime() < soonest.getTime() ? candidate : soonest
      )
    : null;
}
