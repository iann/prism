/** @jest-environment jsdom */
import React from 'react';
import * as SunCalc from 'suncalc';
import { act, render, screen, waitFor } from '@testing-library/react';
import { DAY_MS, getSolarDay, MAP_HEIGHT, solarDayKey } from '@/lib/solar/solar';
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

  it('updates global illumination and elapsed arc progress live', () => {
    const { container } = render(<SolarWorldMap lat={42.36} lon={-71.06} />);
    const elapsedArc = screen
      .getByTestId('solar-dotted-arc')
      .querySelector('[data-solar-arc-band="daylight"][data-solar-arc-phase="elapsed"]');
    const elapsedPath = elapsedArc?.getAttribute('d');
    const cap = container.querySelector('[data-solar-band="0"]')?.getAttribute('d');

    act(() => jest.advanceTimersByTime(60_000));

    expect(elapsedArc?.getAttribute('d')).not.toBe(elapsedPath);
    expect(container.querySelector('[data-solar-band="0"]')?.getAttribute('d')).not.toBe(cap);
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

  it('knocks a clear channel behind the SunCalc arc and pins the Sun to its current sample', () => {
    const location = { lat: 42.36, lon: -71.06 };
    render(<SolarWorldMap {...location} />);

    const arc = screen.getByTestId('solar-dotted-arc');
    const channel = screen.getByTestId('solar-arc-clear-channel');
    const marker = screen.getByTestId('solar-arc-sun-marker');
    const disc = screen.getByTestId('solar-arc-sun-disc');
    const elapsed = screen.getByTestId('solar-arc-daylight-elapsed');
    const future = screen.getByTestId('solar-arc-daylight-future');
    const now = Date.now();
    const day = getSolarDay(solarDayKey(now, location.lon), location);
    const altitude = SunCalc.getPosition(new Date(now), location.lat, location.lon).altitude;
    const progress = (now - (day.noon - DAY_MS / 2)) / DAY_MS;
    const expectedX = (24 + 952 * progress).toFixed(2);
    const expectedY = (MAP_HEIGHT / 2 - (altitude / 90) * MAP_HEIGHT * 0.414).toFixed(2);

    expect(arc.firstElementChild).toBe(channel);
    expect(arc.lastElementChild).toBe(marker);
    expect(disc.getAttribute('cx')).toBe(expectedX);
    expect(disc.getAttribute('cy')).toBe(expectedY);
    expect(elapsed.getAttribute('d')?.endsWith(`L${expectedX},${expectedY}`)).toBe(true);
    expect(future.getAttribute('d')?.startsWith(`M${expectedX},${expectedY}`)).toBe(true);
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
    const daylight = arc.querySelector('[data-testid="solar-arc-daylight-elapsed"]');
    const civil = arc.querySelector('[data-testid="solar-arc-civil-future"]');
    const nautical = arc.querySelector('[data-testid="solar-arc-nautical-future"]');
    const astronomical = arc.querySelector('[data-testid="solar-arc-astronomical-future"]');
    const night = arc.querySelector('[data-testid="solar-arc-night-future"]');

    expect(daylight?.getAttribute('stroke-dasharray')).toBe('0.1 14');
    expect(daylight?.getAttribute('stroke-width')).toBe('4.2');
    expect(daylight?.getAttribute('stroke')).toBe('var(--solar-sun)');
    expect(civil?.getAttribute('stroke')).toBe('var(--solar-arc-civil)');
    expect(nautical?.getAttribute('stroke')).toBe('var(--solar-arc-nautical)');
    expect(astronomical?.getAttribute('stroke')).toBe('var(--solar-arc-astronomical)');
    expect(night?.getAttribute('stroke')).toBe('var(--solar-arc-night)');
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
