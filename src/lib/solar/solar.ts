import * as SunCalc from 'suncalc';

export const DAY_MS = 86_400_000;
const RAD = Math.PI / 180;
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 400;
export type Coordinates = { lat: number; lon: number };
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type SolarSample = SunCalc.Position & { time: number };

export function validCoordinates(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}

export function wrapLongitude(value: number): number {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

export function project({ lat, lon }: Coordinates) {
  // Lambert cylindrical equal-area, normalized to the widget's 5:2 frame
  // (about a 27° standard parallel). Longitude stays linear; latitude uses
  // sin(phi), preserving area while bringing the poles closer together.
  return {
    x: ((lon + 180) / 360) * MAP_WIDTH,
    y: ((1 - Math.sin(lat * RAD)) / 2) * MAP_HEIGHT,
  };
}

/** Horizontal translation that places a longitude at the center of the map.
 * The result is intentionally periodic by MAP_WIDTH so wrapped map copies can
 * scroll continuously as the subsolar meridian crosses the date line. */
export function sunFixedMapOffset(subsolarLongitude: number): number {
  const longitude = wrapLongitude(subsolarLongitude);
  return MAP_WIDTH / 2 - project({ lat: 0, lon: longitude }).x;
}

export function unproject(x: number, y: number): Coordinates {
  const normalizedY = Math.max(0, Math.min(1, y / MAP_HEIGHT));
  return {
    lat: Math.asin(1 - 2 * normalizedY) / RAD,
    lon: Math.max(-180, Math.min(180, (x / MAP_WIDTH) * 360 - 180)),
  };
}

/** Invert SunCalc v2's Meeus 16.4 refraction correction. The terminator and
 * twilight use the geometric solar center, not its refracted apparent height.
 * Keep the ephemeris itself in SunCalc so the global and local views agree.
 * Formula: https://github.com/mourner/suncalc/blob/v2.0.2/index.js
 */
export function geometricAltitude(apparentDegrees: number): number {
  let low = -90;
  let high = 90;
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2;
    const h = Math.max(0, middle) * RAD;
    const refraction = 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179)) / RAD;
    if (middle + refraction < apparentDegrees) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/** At (0°, 0°), local up/east/north are Earth-fixed x/y/z. Transform the
 * solar direction into that frame to find the point directly below the Sun. */
export function getSubsolarPoint(date: Date): Coordinates {
  const position = SunCalc.getPosition(date, 0, 0);
  const altitude = geometricAltitude(position.altitude) * RAD;
  const azimuth = position.azimuth * RAD;
  const x = Math.sin(altitude);
  const y = Math.cos(altitude) * Math.sin(azimuth);
  const z = Math.cos(altitude) * Math.cos(azimuth);
  return { lat: Math.asin(Math.max(-1, Math.min(1, z))) / RAD, lon: Math.atan2(y, x) / RAD };
}

export function solarElevation(location: Coordinates, subsolar: Coordinates): number {
  const a = location.lat * RAD;
  const b = subsolar.lat * RAD;
  return (
    Math.asin(
      Math.max(
        -1,
        Math.min(
          1,
          Math.sin(a) * Math.sin(b) +
            Math.cos(a) * Math.cos(b) * Math.cos((location.lon - subsolar.lon) * RAD)
        )
      )
    ) / RAD
  );
}

/** Width of the dark cap at a latitude, centered on the antisolar meridian.
 * Clamping handles polar day/night and the limit at the geographic poles. */
export function nightHalfWidth(lat: number, declination: number, threshold = 0): number {
  const a = Math.sin(lat * RAD) * Math.sin(declination * RAD);
  const b = Math.cos(lat * RAD) * Math.cos(declination * RAD);
  if (Math.abs(b) < 1e-12) {
    if (threshold === 0 && Math.abs(declination) < 1e-12) return 90;
    return a <= Math.sin(threshold * RAD) ? 180 : 0;
  }
  const cosine = (Math.sin(threshold * RAD) - a) / b;
  return 180 - Math.acos(Math.max(-1, Math.min(1, cosine))) / RAD;
}

/** Periodic copies are clipped at the map edges, avoiding dateline seams and
 * equinox singularities. Each nested cap adds one six-degree twilight band. */
export function nightPath(subsolar: Coordinates, threshold = 0, outline = false): string {
  const center = project({ lat: 0, lon: wrapLongitude(subsolar.lon + 180) }).x;
  const left: string[] = [];
  const right: string[] = [];
  const edges = ['', ''];
  let connected = false;
  const limit = 90 - Math.abs(subsolar.lat);
  const latitudes = new Set([limit, -limit]);
  for (let lat = 90; lat >= -90; lat -= 0.5) latitudes.add(lat);
  for (const lat of [...latitudes].sort((a, b) => b - a)) {
    const y = project({ lat, lon: 0 }).y;
    const half = (nightHalfWidth(lat, subsolar.lat, threshold) / 360) * MAP_WIDTH;
    left.push(`${(center - half).toFixed(2)},${y.toFixed(2)}`);
    right.push(`${(center + half).toFixed(2)},${y.toFixed(2)}`);
    // The polygon collapses to a line during polar daylight, and spans a full
    // map during polar night. Neither artificial closure is a terminator.
    if (Math.abs(lat) <= limit) {
      edges[0] += `${connected ? 'L' : 'M'}${left[left.length - 1]}`;
      edges[1] += `${connected ? 'L' : 'M'}${right[right.length - 1]}`;
      connected = true;
    } else connected = false;
  }
  if (outline) return edges.join('');
  return `M${left.join('L')}L${right.reverse().join('L')}Z`;
}

export function solarDayKey(time: number, lon: number): string {
  // A solar day follows longitude, independent of the viewer's civil timezone.
  return new Date(time + (lon / 360) * DAY_MS).toISOString().slice(0, 10);
}

export function getSolarDay(day: string, location: Coordinates) {
  const anchor = new Date(Date.parse(`${day}T12:00:00Z`) - (location.lon / 360) * DAY_MS);
  const times = SunCalc.getTimes(anchor, location.lat, location.lon);
  const noon = times.solarNoon.getTime();
  const start = times.sunrise?.getTime() ?? noon - DAY_MS / 2;
  const end = times.sunset?.getTime() ?? noon + DAY_MS / 2;
  const samples: SolarSample[] = [];
  // Sample the full solar day too, for an honest below-horizon current marker.
  const instants = new Set([start, noon, end]);
  for (let i = 0; i <= 144; i++) instants.add(noon - DAY_MS / 2 + (i * DAY_MS) / 144);
  for (const time of [...instants].sort((a, b) => a - b)) {
    samples.push({ time, ...SunCalc.getPosition(new Date(time), location.lat, location.lon) });
  }
  return {
    times,
    samples,
    start,
    end,
    noon,
    maxElevation: Math.max(...samples.map((sample) => sample.altitude)),
    noonAzimuth: SunCalc.getPosition(times.solarNoon, location.lat, location.lon).azimuth,
    dayLength: times.alwaysDown ? 0 : times.alwaysUp ? DAY_MS : end - start,
  };
}

export type SolarDay = ReturnType<typeof getSolarDay>;

/** Azimuth is the horizontal axis, centered on the noon-facing sky. Elevation
 * has a fixed 0–90° scale. The below-horizon strip is compressed and labeled. */
export function skyPoint(position: SunCalc.Position, noonAzimuth: number) {
  return {
    x: 760 + (wrapLongitude(position.azimuth - noonAzimuth) / 180) * 190,
    y:
      640 -
      (position.altitude >= 0 ? (position.altitude / 90) * 110 : (position.altitude / 90) * 25),
  };
}

export function skyPath(samples: SolarSample[], noonAzimuth: number): string {
  let previousX: number | undefined;
  return samples
    .map((sample) => {
      const { x, y } = skyPoint(sample, noonAzimuth);
      const move = previousX === undefined || Math.abs(x - previousX) > 190;
      previousX = x;
      return `${move ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join('');
}

/** Find this year's astronomical event using the same solar declination.
 * Solstices are extrema; equinoxes are zero crossings. Southern seasons swap. */
export function seasonInstant(year: number, season: Season, southern: boolean): Date {
  const order: Season[] = ['spring', 'summer', 'fall', 'winter'];
  const index = (order.indexOf(season) + (southern ? 2 : 0)) % 4;
  let low = Date.UTC(year, 2 + index * 3, 15);
  let high = Date.UTC(year, 2 + index * 3, 26);
  const declination = (ms: number) => getSubsolarPoint(new Date(ms)).lat;
  for (let i = 0; i < 40; i++) {
    if (index % 2 === 0) {
      const middle = (low + high) / 2;
      if (declination(middle) < 0 === (index === 0)) low = middle;
      else high = middle;
    } else {
      const a = low + (high - low) / 3;
      const b = high - (high - low) / 3;
      if (declination(a) < declination(b) === (index === 1)) low = a;
      else high = b;
    }
  }
  return new Date((low + high) / 2);
}
