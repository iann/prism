'use client';

import * as React from 'react';
import * as SunCalc from 'suncalc';
import {
  DAY_MS,
  getSolarDay,
  getSubsolarPoint,
  MAP_HEIGHT,
  MAP_WIDTH,
  nightPath,
  solarDayKey,
  sunFixedMapOffset,
  validCoordinates,
  type Coordinates,
  type SolarDay,
  type SolarSample,
} from '@/lib/solar/solar';
import land from '@/lib/solar/world-land.json';
import styles from './SolarWorldMap.module.css';

const DEFAULT_LOCATION = { lat: 41.8781, lon: -87.6298 };
export const COMPACT_SOLAR_MAP_ASPECT_RATIO = 2.5;
// Keep the tile an exact divisor of the map width so the dot phase wraps
// seamlessly when the map crosses the date line.
const LAND_DOT_SPACING = MAP_WIDTH / Math.round(MAP_WIDTH / 14);
const LAND_DOT_DIAMETER = 4.2;
const SOLAR_ARC_DOT_INTERVAL = 20 * 60 * 1000;
const SOLAR_ARC_DOT_COUNT = DAY_MS / SOLAR_ARC_DOT_INTERVAL + 1;
const SOLAR_ARC_BANDS = [
  { key: 'daylight', min: 0, max: Number.POSITIVE_INFINITY, color: 'var(--solar-sun)' },
  { key: 'civil', min: -6, max: 0, color: 'var(--solar-arc-civil)' },
  { key: 'nautical', min: -12, max: -6, color: 'var(--solar-arc-nautical)' },
  { key: 'astronomical', min: -18, max: -12, color: 'var(--solar-arc-astronomical)' },
  { key: 'night', min: Number.NEGATIVE_INFINITY, max: -18, color: 'var(--solar-arc-night)' },
] as const;
const LAND_DOT_BANDS = [
  { key: 'day', color: 'var(--solar-land-day)', outer: null, inner: 0 },
  { key: 'civil', color: 'var(--solar-land-civil)', outer: 0, inner: 1 },
  { key: 'nautical', color: 'var(--solar-land-nautical)', outer: 1, inner: 2 },
  { key: 'astronomical', color: 'var(--solar-land-astronomical)', outer: 2, inner: 3 },
  { key: 'night', color: 'var(--solar-land-night)', outer: 3, inner: null },
] as const;
const coordinateLabel = ({ lat, lon }: Coordinates) =>
  `${Math.abs(lat).toFixed(1)}° ${lat < 0 ? 'S' : 'N'} · ${Math.abs(lon).toFixed(1)}° ${lon < 0 ? 'W' : 'E'}`;

type SolarArcSample = Pick<SolarSample, 'time' | 'altitude'>;

function mapSolarArcPoint(sample: SolarArcSample, day: SolarDay) {
  const progress = (sample.time - (day.noon - DAY_MS / 2)) / DAY_MS;
  const altitude = Math.max(-90, Math.min(90, sample.altitude));
  return {
    x: 24 + 952 * Math.max(0, Math.min(1, progress)),
    // Altitude zero sits on the map's equator. Positive solar altitude rises
    // above it; below-horizon twilight/night dips below it.
    y:
      altitude >= 0
        ? MAP_HEIGHT / 2 - (altitude / 90) * MAP_HEIGHT * 0.414
        : MAP_HEIGHT / 2 + (-altitude / 90) * MAP_HEIGHT * 0.29,
  };
}

function withTwilightCrossings(samples: SolarArcSample[]): SolarArcSample[] {
  const points: SolarArcSample[] = [];
  samples.forEach((sample, index) => {
    const previous = samples[index - 1];
    if (previous) {
      const crossings = SOLAR_ARC_BANDS.slice(0, -1)
        .flatMap(({ min }) => {
          if (
            !(previous.altitude < min && sample.altitude > min) &&
            !(previous.altitude > min && sample.altitude < min)
          ) {
            return [];
          }
          const fraction = (min - previous.altitude) / (sample.altitude - previous.altitude);
          return [
            {
              time: previous.time + fraction * (sample.time - previous.time),
              altitude: min,
            },
          ];
        })
        .sort((a, b) => a.time - b.time);
      points.push(...crossings);
    }
    points.push(sample);
  });
  return points;
}

function solarArcPath(samples: SolarArcSample[], day: SolarDay) {
  return samples
    .map((sample, index) => {
      const { x, y } = mapSolarArcPoint(sample, day);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join('');
}

function solarArcSegments(
  samples: SolarArcSample[],
  day: SolarDay,
  keep: (sample: SolarArcSample) => boolean
) {
  const paths: string[] = [];
  let segment: SolarArcSample[] = [];
  samples.forEach((sample) => {
    if (keep(sample)) segment.push(sample);
    else {
      if (segment.length > 1) paths.push(solarArcPath(segment, day));
      segment = [];
    }
  });
  if (segment.length > 1) paths.push(solarArcPath(segment, day));
  return paths.join('');
}

function SolarMapDrawing({
  time,
  location,
  name,
  day,
}: {
  time: number;
  location: Coordinates;
  name: string;
  day: SolarDay;
}) {
  const id = React.useId().replace(/:/g, '');
  const subsolar = React.useMemo(() => getSubsolarPoint(new Date(time)), [time]);
  const mapOffset = sunFixedMapOffset(subsolar.lon);
  // Freeze the shadow's seasonal tilt for the selected solar day. Only the
  // land layer follows the live subsolar longitude during that day.
  const shadowSubsolar = React.useMemo(
    () => ({ lat: getSubsolarPoint(new Date(day.noon)).lat, lon: 0 }),
    [day.noon]
  );
  const caps = React.useMemo(
    () => [0, -6, -12, -18].map((altitude) => nightPath(shadowSubsolar, altitude)),
    [shadowSubsolar]
  );
  const terminator = React.useMemo(() => nightPath(shadowSubsolar, 0, true), [shadowSubsolar]);
  const current: SolarSample = {
    time,
    ...SunCalc.getPosition(new Date(time), location.lat, location.lon),
  };
  const all = [...day.samples.filter((sample) => sample.time !== time), current].sort(
    (a, b) => a.time - b.time
  );
  const arcSamples = withTwilightCrossings(
    all.map(({ time: sampleTime, altitude }) => ({ time: sampleTime, altitude }))
  );
  const currentSunPoint = mapSolarArcPoint(current, day);
  const elapsedDaylight = solarArcSegments(
    arcSamples,
    day,
    (sample) => sample.time <= time && sample.altitude >= 0
  );
  const solarArcDots = React.useMemo(() => {
    const start = day.noon - DAY_MS / 2;
    return Array.from({ length: SOLAR_ARC_DOT_COUNT }, (_, index) => {
      const sampleTime = start + index * SOLAR_ARC_DOT_INTERVAL;
      const altitude = SunCalc.getPosition(
        new Date(sampleTime),
        location.lat,
        location.lon
      ).altitude;
      const band = SOLAR_ARC_BANDS.find(({ min, max }) => altitude >= min && altitude < max)!;
      return {
        time: sampleTime,
        ...mapSolarArcPoint({ time: sampleTime, altitude }, day),
        band,
      };
    });
  }, [day, location.lat, location.lon]);
  return (
    <svg
      className={styles.drawing}
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Solar world map for ${name}`}
    >
      <title>Earth illumination and the local Sun path</title>
      <desc>
        Earth&apos;s dotted land moves beneath fixed illumination and twilight, centered on the
        subsolar meridian. The selected location&apos;s daily solar-altitude arc stays centered over
        daylight. The equator is a thin reference line for zero altitude. Evenly spaced dots follow
        the Sun&apos;s local path through daylight, twilight, and night; it is not a geographic
        route. A restrained gold trail highlights the daylight already traveled, and a gold marker
        shows the current Sun position along the arc.
      </desc>
      <defs>
        <clipPath id={`${id}-map`}>
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} />
        </clipPath>
        <clipPath
          id={`${id}-land`}
          clipPathUnits="userSpaceOnUse"
          data-map-offset={mapOffset.toFixed(3)}
        >
          {[-MAP_WIDTH, 0, MAP_WIDTH].map((shift) => (
            <path
              key={shift}
              d={land.path}
              transform={`translate(${(mapOffset + shift).toFixed(3)} 0)`}
            />
          ))}
        </clipPath>
        {LAND_DOT_BANDS.map((band) => (
          <React.Fragment key={band.key}>
            <pattern
              id={`${id}-land-dots-${band.key}`}
              width={LAND_DOT_SPACING}
              height={LAND_DOT_SPACING}
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${mapOffset.toFixed(3)} 0)`}
            >
              <circle cx="2.2" cy="2.2" r="2.1" fill={band.color} />
            </pattern>
            <mask
              id={`${id}-land-mask-${band.key}`}
              x="0"
              y="0"
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
            >
              {band.outer === null ? (
                <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="white" />
              ) : (
                [-1000, 0, 1000].map((shift) => (
                  <path
                    key={`outer-${shift}`}
                    d={caps[band.outer]}
                    transform={`translate(${shift} 0)`}
                    fill="white"
                  />
                ))
              )}
              {band.inner !== null &&
                [-1000, 0, 1000].map((shift) => (
                  <path
                    key={`inner-${shift}`}
                    d={caps[band.inner]}
                    transform={`translate(${shift} 0)`}
                    fill="black"
                  />
                ))}
            </mask>
          </React.Fragment>
        ))}
        <filter
          id={`${id}-twilight`}
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <g clipPath={`url(#${id}-map)`}>
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="var(--solar-ocean)" />
        <g filter={`url(#${id}-twilight)`}>
          {caps.map((path, band) =>
            [-1000, 0, 1000].map((shift) => (
              <path
                key={`${band}-${shift}`}
                data-solar-band={band}
                d={path}
                transform={`translate(${shift} 0)`}
                fill={
                  [
                    'var(--solar-civil)',
                    'var(--solar-nautical)',
                    'var(--solar-astronomical)',
                    'var(--solar-night)',
                  ][band]
                }
              />
            ))
          )}
        </g>
        <g
          className={styles.landDots}
          data-testid="world-map-land"
          data-map-offset={mapOffset.toFixed(3)}
        >
          {LAND_DOT_BANDS.map((band) => (
            <rect
              key={band.key}
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              fill={`url(#${id}-land-dots-${band.key})`}
              clipPath={`url(#${id}-land)`}
              mask={`url(#${id}-land-mask-${band.key})`}
              data-solar-dot-band={band.key}
              data-testid={`world-map-dots-${band.key}`}
            />
          ))}
        </g>
        <path
          d={`M0 ${MAP_HEIGHT / 2}H${MAP_WIDTH}`}
          className={styles.equator}
          data-testid="solar-equator-line"
          aria-label="Equator, used as the solar arc's zero-altitude baseline"
        />
        {[-1000, 0, 1000].map((shift) => (
          <path
            key={shift}
            d={terminator}
            transform={`translate(${shift} 0)`}
            fill="none"
            stroke="var(--solar-terminator)"
            strokeWidth="1.3"
            opacity=".3"
            data-testid="solar-terminator"
          />
        ))}
      </g>
      <g
        data-solar-arc="true"
        role="group"
        aria-label={`Local daily solar-altitude arc for ${name}`}
      >
        <g data-testid="solar-dotted-arc" aria-label="Local solar path with twilight bands">
          {elapsedDaylight && (
            <path
              d={elapsedDaylight}
              className={styles.solarArcElapsedTrail}
              data-testid="solar-arc-elapsed-trail"
              aria-hidden="true"
            />
          )}
          {solarArcDots.map((dot) => (
            <circle
              key={dot.time}
              cx={dot.x.toFixed(2)}
              cy={dot.y.toFixed(2)}
              r={LAND_DOT_DIAMETER / 2}
              className={`${styles.solarArcDot} ${
                dot.time <= time ? styles.solarArcElapsed : styles.solarArcFuture
              }`}
              fill={dot.band.color}
              data-solar-arc-time={dot.time}
              data-solar-arc-band={dot.band.key}
              data-solar-arc-phase={dot.time <= time ? 'elapsed' : 'future'}
              data-testid="solar-arc-dot"
              aria-hidden="true"
            />
          ))}
          <g
            data-testid="solar-arc-sun-marker"
            role="img"
            aria-label="Current Sun position on the local solar arc"
          >
            <circle
              cx={currentSunPoint.x.toFixed(2)}
              cy={currentSunPoint.y.toFixed(2)}
              r="14"
              className={styles.solarArcSunHalo}
              aria-hidden="true"
            />
            <circle
              cx={currentSunPoint.x.toFixed(2)}
              cy={currentSunPoint.y.toFixed(2)}
              r="8"
              className={styles.solarArcSunDisc}
              data-testid="solar-arc-sun-disc"
              aria-hidden="true"
            />
            <circle
              cx={currentSunPoint.x.toFixed(2)}
              cy={currentSunPoint.y.toFixed(2)}
              r="2.6"
              className={styles.solarArcSunCore}
              aria-hidden="true"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}

export type SolarWorldMapProps = {
  lat?: number;
  lon?: number;
  locationName?: string;
  compact?: boolean;
  /** Read optional lat/lon URL parameters on the dedicated wall display. */
  readUrl?: boolean;
};

export function SolarWorldMap({
  lat,
  lon,
  locationName,
  compact = false,
  readUrl = false,
}: SolarWorldMapProps) {
  const [clock, setClock] = React.useState<number | null>(null);
  const [urlLocation, setUrlLocation] = React.useState<Coordinates | null>(null);
  const configured = lat !== undefined && lon !== undefined && validCoordinates(lat, lon);
  const location = urlLocation ?? (configured ? { lat, lon } : DEFAULT_LOCATION);
  const name = urlLocation
    ? coordinateLabel(urlLocation)
    : configured
      ? locationName || 'Home'
      : 'Chicago';
  const locationLat = location.lat;
  const locationLon = location.lon;
  const dayKey = clock === null ? null : solarDayKey(clock, location.lon);
  const day = React.useMemo(
    () => (dayKey ? getSolarDay(dayKey, { lat: locationLat, lon: locationLon }) : null),
    [dayKey, locationLat, locationLon]
  );

  React.useEffect(() => {
    // Initialize after hydration so the server and browser use the same live clock.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClock(Date.now());
    const interval = setInterval(() => setClock(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (!readUrl) return;
    const params = new URLSearchParams(window.location.search);
    const latitude = params.get('lat');
    const longitude = params.get('lon');
    if (
      latitude?.trim() &&
      longitude?.trim() &&
      validCoordinates(Number(latitude), Number(longitude))
    ) {
      // URL coordinates are a browser-only configuration input.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrlLocation({ lat: Number(latitude), lon: Number(longitude) });
    }
  }, [readUrl]);

  if (clock === null || !day)
    return (
      <div className={styles.loading} role="status">
        Finding the sunlight…
      </div>
    );

  return (
    <div
      className={`${styles.display} ${compact ? styles.compact : ''}`}
      data-testid="solar-display"
    >
      {compact ? (
        <div
          className={styles.compactVisual}
          data-testid="solar-map-compact-visual"
          style={{ aspectRatio: COMPACT_SOLAR_MAP_ASPECT_RATIO }}
        >
          <SolarMapDrawing time={clock} location={location} name={name} day={day} />
        </div>
      ) : (
        <div className={styles.mapFrame}>
          <SolarMapDrawing time={clock} location={location} name={name} day={day} />
        </div>
      )}
    </div>
  );
}
