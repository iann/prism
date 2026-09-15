import SunCalc from 'suncalc';

export type SolarCoordinates = {
  lat: number;
  lon: number;
};

/** Keep the setting useful for ordinary dusk adjustments without allowing it
 * to move the theme transition into an unrelated part of the day. */
export const MIN_SUNSET_OFFSET_MINUTES = -180;
export const MAX_SUNSET_OFFSET_MINUTES = 180;

export function normalizeSunsetOffsetMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;

  return Math.min(
    MAX_SUNSET_OFFSET_MINUTES,
    Math.max(MIN_SUNSET_OFFSET_MINUTES, Math.round(value))
  );
}

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

function isValidDate(value: Date | undefined): value is Date {
  return value !== undefined && Number.isFinite(value.getTime());
}

export function applySunsetOffset(sunset: Date, offsetMinutes = 0): Date {
  if (!isValidDate(sunset)) return sunset;

  return new Date(sunset.getTime() + normalizeSunsetOffsetMinutes(offsetMinutes) * 60 * 1000);
}

function getSolarEvents(now: Date, coordinates: SolarCoordinates, offsetMinutes: number) {
  const dayMs = 24 * 60 * 60 * 1000;

  return [-1, 0, 1].flatMap((day) => {
    const times = SunCalc.getTimes(
      new Date(now.getTime() + day * dayMs),
      coordinates.lat,
      coordinates.lon
    );

    return [
      { type: 'sunrise' as const, time: times.sunrise },
      { type: 'sunset' as const, time: applySunsetOffset(times.sunset, offsetMinutes) },
    ];
  });
}

/**
 * Resolve the automatic brightness for a location.
 *
 * Solar events are used instead of comparing the browser's clock with a
 * cached sunset timestamp. That keeps the mode correct across midnight,
 * supports a sunset offset, and lets it switch back to light at the next
 * sunrise even while weather data is being refreshed.
 */
export function resolveSunsetTheme(
  now: Date,
  coordinates?: SolarCoordinates,
  fallbackSunset?: Date,
  sunsetOffsetMinutes = 0
): 'light' | 'dark' | null {
  if (hasSolarCoordinates(coordinates)) {
    const events = getSolarEvents(now, coordinates, sunsetOffsetMinutes);
    const latestSunset = events
      .filter((event) => event.type === 'sunset' && isValidDate(event.time))
      .filter((event) => event.time.getTime() <= now.getTime())
      .reduce<Date | null>(
        (latest, event) =>
          latest === null || event.time.getTime() > latest.getTime() ? event.time : latest,
        null
      );
    const nextSunrise = events
      .filter((event) => event.type === 'sunrise' && isValidDate(event.time))
      .filter((event) => latestSunset !== null && event.time.getTime() > latestSunset.getTime())
      .reduce<Date | null>(
        (next, event) =>
          next === null || event.time.getTime() < next.getTime() ? event.time : next,
        null
      );

    if (latestSunset !== null && nextSunrise !== null) {
      return now.getTime() >= latestSunset.getTime() && now.getTime() < nextSunrise.getTime()
        ? 'dark'
        : 'light';
    }

    // SunCalc can return invalid event times at extreme latitudes. Preserve
    // the previous position-based behavior when there is no usable event.
    return SunCalc.getPosition(now, coordinates.lat, coordinates.lon).altitude < 0
      ? 'dark'
      : 'light';
  }

  if (isValidDate(fallbackSunset)) {
    const adjustedSunset = applySunsetOffset(fallbackSunset, sunsetOffsetMinutes);
    return now.getTime() >= adjustedSunset.getTime() ? 'dark' : 'light';
  }

  return null;
}

/**
 * Find the next sunrise or sunset so the theme can update without waiting for
 * the weather polling interval. SunCalc returns Date values in absolute time,
 * so this remains correct across timezone and daylight-saving changes.
 */
export function getNextSolarTransition(
  now: Date,
  coordinates?: SolarCoordinates,
  sunsetOffsetMinutes = 0
): Date | null {
  if (!hasSolarCoordinates(coordinates)) return null;

  const candidates: Date[] = [];
  const dayMs = 24 * 60 * 60 * 1000;

  for (let day = 0; day <= 2; day += 1) {
    const times = SunCalc.getTimes(
      new Date(now.getTime() + day * dayMs),
      coordinates.lat,
      coordinates.lon
    );
    for (const transition of [
      times.sunrise,
      applySunsetOffset(times.sunset, sunsetOffsetMinutes),
    ]) {
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
