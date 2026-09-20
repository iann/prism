/** @jest-environment jsdom */
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
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

  it('updates global illumination and the local Sun position live', () => {
    const { container } = render(<SolarWorldMap lat={42.36} lon={-71.06} />);
    const localSun = screen.getByTestId('local-sun-position');
    const localX = localSun.getAttribute('cx');
    const cap = container.querySelector('[data-solar-band="0"]')?.getAttribute('d');

    act(() => jest.advanceTimersByTime(60_000));

    expect(localSun.getAttribute('cx')).not.toBe(localX);
    expect(container.querySelector('[data-solar-band="0"]')?.getAttribute('d')).not.toBe(cap);
  });

  it('renders only the map and arc, without point markers or control chrome', () => {
    render(<SolarWorldMap lat={42.36} lon={-71.06} locationName="Boston" />);

    expect(screen.getByRole('img', { name: 'Solar world map for Boston' })).toBeTruthy();
    expect(screen.getByTestId('local-sun-position')).toBeTruthy();
    expect(screen.queryByTestId('subsolar-point')).toBeNull();
    expect(screen.queryByTestId('selected-location')).toBeNull();
    expect(screen.queryByText('LOCAL SKY')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('keeps the compact map at its natural 2:1 projection ratio', () => {
    const { container } = render(<SolarWorldMap compact lat={42.36} lon={-71.06} />);
    const map = container.querySelector('svg[role="img"]');

    expect(map?.getAttribute('viewBox')).toBe('0 0 1000 500');
    expect(map?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
  });

  it('uses a solid equator baseline without sunrise or sunset endpoint markers', () => {
    render(<SolarWorldMap lat={42.36} lon={-71.06} />);

    const equator = screen.getByTestId('solar-equator-line');

    expect(equator.getAttribute('d')).toBe('M0 250H1000');
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
