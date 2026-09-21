/** @jest-environment jsdom */
import React from 'react';
import * as SunCalc from 'suncalc';
import { act, render, screen, waitFor } from '@testing-library/react';
import {
  DAY_MS,
  getSolarDay,
  getSubsolarPoint,
  MAP_HEIGHT,
  MAP_WIDTH,
  nightHalfWidth,
  solarDayKey,
} from '@/lib/solar/solar';
import { SolarWorldMap } from '../SolarWorldMap';

describe('SolarWorldMap display', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-21T16:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
    window.history.replaceState({}, '', '/');
  });

  it('keeps illumination fixed while the dotted map and local Sun position update live', () => {
    const { container } = render(<SolarWorldMap lat={42.36} lon={-71.06} />);
    const elapsedTrail = screen.getByTestId('solar-arc-elapsed-trail');
    const trailPath = elapsedTrail.getAttribute('d');
    const sunDisc = screen.getByTestId('solar-arc-sun-disc');
    const sunX = sunDisc.getAttribute('cx');
    const cap = container.querySelector('[data-solar-band="0"]')?.getAttribute('d');
    const terminator = screen.getAllByTestId('solar-terminator')[0]?.getAttribute('d');
    const land = screen.getByTestId('world-map-land');
    const mapOffset = land.getAttribute('data-map-offset');
    const patternTransform = container.querySelector('pattern')?.getAttribute('patternTransform');
    const maskMarkup = container.querySelector('mask[id$="-land-mask-civil"]')?.outerHTML;
    const firstArcDot = screen.getAllByTestId('solar-arc-dot')[0]!;
    const firstArcDotPosition = [firstArcDot.getAttribute('cx'), firstArcDot.getAttribute('cy')];

    act(() => jest.advanceTimersByTime(60_000));

    expect(elapsedTrail.getAttribute('d')).not.toBe(trailPath);
    expect(sunDisc.getAttribute('cx')).not.toBe(sunX);
    expect(container.querySelector('[data-solar-band="0"]')?.getAttribute('d')).toBe(cap);
    expect(screen.getAllByTestId('solar-terminator')[0]?.getAttribute('d')).toBe(terminator);
    expect(land.getAttribute('data-map-offset')).not.toBe(mapOffset);
    expect(container.querySelector('pattern')?.getAttribute('patternTransform')).not.toBe(
      patternTransform
    );
    expect(container.querySelector('mask[id$="-land-mask-civil"]')?.outerHTML).toBe(maskMarkup);
    expect(firstArcDot.getAttribute('cx')).toBe(firstArcDotPosition[0]);
    expect(firstArcDot.getAttribute('cy')).toBe(firstArcDotPosition[1]);
  });

  it('shows the current Sun on the local arc without geographic markers or control chrome', () => {
    render(<SolarWorldMap lat={42.36} lon={-71.06} locationName="Boston" />);

    expect(screen.getByRole('img', { name: 'Solar world map for Boston' })).toBeTruthy();
    expect(screen.getByTestId('solar-arc-sun-marker')).toBeTruthy();
    expect(screen.queryByTestId('local-sun-position')).toBeNull();
    expect(screen.queryByTestId('subsolar-point')).toBeNull();
    expect(screen.queryByTestId('selected-location')).toBeNull();
    expect(screen.queryByText('LOCAL SKY')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('highlights elapsed daylight behind the SunCalc arc and pins the Sun to its current sample', () => {
    const location = { lat: 42.36, lon: -71.06 };
    render(<SolarWorldMap {...location} />);

    const arc = screen.getByTestId('solar-dotted-arc');
    const trail = screen.getByTestId('solar-arc-elapsed-trail');
    const marker = screen.getByTestId('solar-arc-sun-marker');
    const disc = screen.getByTestId('solar-arc-sun-disc');
    const elapsedDaylightDots = arc.querySelectorAll(
      '[data-solar-arc-band="daylight"][data-solar-arc-phase="elapsed"]'
    );
    const futureDaylightDots = arc.querySelectorAll(
      '[data-solar-arc-band="daylight"][data-solar-arc-phase="future"]'
    );
    const allDots = [...arc.querySelectorAll('[data-testid="solar-arc-dot"]')];
    const now = Date.now();
    const day = getSolarDay(solarDayKey(now, location.lon), location);
    const altitude = SunCalc.getPosition(new Date(now), location.lat, location.lon).altitude;
    const progress = (now - (day.noon - DAY_MS / 2)) / DAY_MS;
    const expectedX = (24 + 952 * progress).toFixed(2);
    const expectedY = (MAP_HEIGHT / 2 - (altitude / 90) * MAP_HEIGHT * 0.414).toFixed(2);

    expect(arc.firstElementChild).toBe(trail);
    expect(screen.queryByTestId('solar-arc-clear-channel')).toBeNull();
    expect(arc.lastElementChild).toBe(marker);
    expect(disc.getAttribute('cx')).toBe(expectedX);
    expect(disc.getAttribute('cy')).toBe(expectedY);
    expect(trail.getAttribute('d')?.endsWith(`L${expectedX},${expectedY}`)).toBe(true);
    expect(elapsedDaylightDots.length).toBeGreaterThan(0);
    expect(futureDaylightDots.length).toBeGreaterThan(0);
    expect(allDots).toHaveLength(73);
    allDots.slice(1).forEach((dot, index) => {
      const gap = Number(dot.getAttribute('cx')) - Number(allDots[index]!.getAttribute('cx'));
      expect(gap).toBeCloseTo(952 / 72, 1);
    });
  });

  it('uses a full-frame 5:2 Lambert map in compact weather widgets', () => {
    const { container } = render(<SolarWorldMap compact lat={42.36} lon={-71.06} />);
    const map = container.querySelector('svg[role="img"]');
    const frame = screen.getByTestId('solar-map-compact-visual') as HTMLDivElement;

    expect(frame.style.aspectRatio).toBe('2.5');
    expect(map?.getAttribute('viewBox')).toBe('0 0 1000 400');
    expect(map?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
  });

  it('uses a solid equator baseline without sunrise or sunset endpoint markers', () => {
    render(<SolarWorldMap lat={42.36} lon={-71.06} />);

    const equator = screen.getByTestId('solar-equator-line');

    expect(equator.getAttribute('d')).toBe('M0 200H1000');
    expect(equator.getAttribute('stroke-dasharray')).toBeNull();
    expect(screen.queryByTestId('solar-event-sunrise')).toBeNull();
    expect(screen.queryByTestId('solar-event-sunset')).toBeNull();
    expect(screen.queryByTestId('solar-equator-daylight')).toBeNull();
  });

  it('keeps geometric shadow edges centered and close to local sunrise and sunset', () => {
    const scenarios = [
      { instant: '2026-06-21T16:00:00Z', location: { lat: 42.4584, lon: -71.0662 } },
      { instant: '2026-03-20T12:00:00Z', location: { lat: 0, lon: 0 } },
      { instant: '2026-12-21T12:00:00Z', location: { lat: -33.87, lon: 151.2 } },
    ];

    scenarios.forEach(({ instant, location }) => {
      jest.setSystemTime(new Date(instant));
      const view = render(<SolarWorldMap {...location} />);
      const day = getSolarDay(solarDayKey(Date.now(), location.lon), location);
      const currentSubsolar = getSubsolarPoint(new Date(instant));
      const terminatorHourAngle = 180 - nightHalfWidth(location.lat, currentSubsolar.lat, 0);
      const shadowSunriseX = MAP_WIDTH / 2 - (terminatorHourAngle / 360) * MAP_WIDTH;
      const shadowSunsetX = MAP_WIDTH / 2 + (terminatorHourAngle / 360) * MAP_WIDTH;
      const xForTime = (time: number) => 24 + (952 * (time - (day.noon - DAY_MS / 2))) / DAY_MS;
      const daylightDots = [
        ...screen
          .getByTestId('solar-dotted-arc')
          .querySelectorAll('[data-solar-arc-band="daylight"]'),
      ];

      expect(day.times.sunrise).toBeInstanceOf(Date);
      expect(day.times.sunset).toBeInstanceOf(Date);
      expect(daylightDots.length).toBeGreaterThan(0);
      expect(
        Math.abs(
          Number(daylightDots[0]!.getAttribute('cx')) - xForTime(day.times.sunrise!.getTime())
        )
      ).toBeLessThan(26);
      expect(
        Math.abs(
          Number(daylightDots.at(-1)!.getAttribute('cx')) - xForTime(day.times.sunset!.getTime())
        )
      ).toBeLessThan(26);
      expect(Math.abs(xForTime(day.times.sunrise!.getTime()) - shadowSunriseX)).toBeLessThan(20);
      expect(Math.abs(xForTime(day.times.sunset!.getTime()) - shadowSunsetX)).toBeLessThan(20);
      expect((shadowSunriseX + shadowSunsetX) / 2).toBeCloseTo(MAP_WIDTH / 2, 8);
      expect(
        screen.getAllByTestId('solar-terminator')[0]?.getAttribute('data-solar-declination')
      ).toBe(currentSubsolar.lat.toFixed(6));
      expect(
        new Set(
          [...view.container.querySelectorAll('[data-solar-cap-altitude]')].map((element) =>
            element.getAttribute('data-solar-cap-altitude')
          )
        )
      ).toEqual(new Set(['0.0000', '-6.0000', '-12.0000', '-18.0000']));
      view.unmount();
    });
  });

  it('wraps the moving land with three periodic copies while masks stay screen-anchored', () => {
    jest.setSystemTime(new Date('2026-06-21T00:00:00Z'));
    const { container } = render(<SolarWorldMap lat={42.36} lon={-71.06} />);
    const landClip = container.querySelector('clipPath[id$="-land"]');
    const copies = landClip?.querySelectorAll('path');
    const mask = container.querySelector('mask[id$="-land-mask-civil"]');
    const land = screen.getByTestId('world-map-land');
    const startOffset = Number(land.getAttribute('data-map-offset'));
    const pattern = container.querySelector('pattern');
    const maskPathTransforms = [...(mask?.querySelectorAll('path') ?? [])].map((path) =>
      path.getAttribute('transform')
    );

    expect(copies).toHaveLength(3);
    const offsets = [...copies!].map((path) =>
      Number(path.getAttribute('transform')?.match(/translate\(([-\d.]+)/)?.[1])
    );
    expect(offsets[1]! - offsets[0]!).toBe(MAP_WIDTH);
    expect(offsets[2]! - offsets[1]!).toBe(MAP_WIDTH);
    expect(maskPathTransforms).toHaveLength(6);
    expect(maskPathTransforms.every((transform) => transform?.match(/^translate\(/))).toBe(true);
    expect(Number(pattern?.getAttribute('width')) * 71).toBeCloseTo(MAP_WIDTH, 8);

    act(() => jest.advanceTimersByTime(5 * 60_000));

    const endOffset = Number(land.getAttribute('data-map-offset'));
    expect(Math.abs(Math.abs(endOffset - startOffset) - MAP_WIDTH)).toBeLessThan(4);
    expect(mask?.outerHTML).toContain('translate(-1000 0)');
  });

  it('colors land dots with the same five light bands used by the local solar arc', () => {
    const { container } = render(<SolarWorldMap lat={42.36} lon={-71.06} />);
    const bands = ['day', 'civil', 'nautical', 'astronomical', 'night'];

    bands.forEach((band) => {
      const dots = screen.getByTestId(`world-map-dots-${band}`);
      const patternId = dots.getAttribute('fill')?.match(/url\(#([^)]+)\)/)?.[1];
      const maskId = dots.getAttribute('mask')?.match(/url\(#([^)]+)\)/)?.[1];

      expect(dots.getAttribute('data-solar-dot-band')).toBe(band);
      expect(dots.getAttribute('clip-path')).toContain('land');
      expect(container.querySelector(`[id="${patternId}"] circle`)?.getAttribute('fill')).toBe(
        `var(--solar-land-${band})`
      );
      expect(container.querySelector(`[id="${maskId}"]`)).toBeTruthy();
    });
  });

  it('uses the map dot cadence and twilight palette for the local solar arc', () => {
    const { container } = render(<SolarWorldMap lat={42.36} lon={-71.06} />);
    const arc = screen.getByTestId('solar-dotted-arc');
    const daylight = arc.querySelector(
      '[data-solar-arc-band="daylight"][data-solar-arc-phase="elapsed"]'
    );
    const civil = arc.querySelector('[data-solar-arc-band="civil"][data-solar-arc-phase="future"]');
    const nautical = arc.querySelector(
      '[data-solar-arc-band="nautical"][data-solar-arc-phase="future"]'
    );
    const astronomical = arc.querySelector(
      '[data-solar-arc-band="astronomical"][data-solar-arc-phase="future"]'
    );
    const night = arc.querySelector('[data-solar-arc-band="night"][data-solar-arc-phase="future"]');

    expect(daylight?.getAttribute('r')).toBe('2.1');
    expect(daylight?.getAttribute('fill')).toBe('var(--solar-sun)');
    expect(civil?.getAttribute('fill')).toBe('var(--solar-arc-civil)');
    expect(nautical?.getAttribute('fill')).toBe('var(--solar-arc-nautical)');
    expect(astronomical?.getAttribute('fill')).toBe('var(--solar-arc-astronomical)');
    expect(night?.getAttribute('fill')).toBe('var(--solar-arc-night)');
    expect(container.querySelector('[data-solar-arc-phase="future"]')).toBeTruthy();
    expect(container.querySelector('[data-solar-arc-phase="elapsed"]')).toBeTruthy();
  });

  it('uses valid coordinates from the wall-display URL', async () => {
    window.history.replaceState({}, '', '/solar?lat=78.2&lon=15.6');
    render(<SolarWorldMap readUrl />);

    await waitFor(() =>
      expect(
        screen.getByRole('img', { name: 'Solar world map for 78.2° N · 15.6° E' })
      ).toBeTruthy()
    );
  });
});
