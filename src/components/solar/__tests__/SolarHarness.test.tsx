import { parseHarnessState } from '../SolarHarness';

describe('solar harness URL state', () => {
  const now = Date.parse('2026-06-21T16:00:00Z');

  it('defaults to a live Boston map-motion view', () => {
    expect(parseHarnessState('', now)).toEqual({
      location: { lat: 42.3601, lon: -71.0589 },
      locationName: 'Boston, MA',
      motionMode: 'map',
      live: true,
      time: now,
      showArc: true,
      theme: 'system',
    });
  });

  it('hydrates a frozen shadow-motion link with a custom location', () => {
    const state = parseHarnessState(
      '?lat=51.5&lon=-0.12&name=London&motion=shadow&live=0&arc=0&theme=dark&time=2026-12-21T12:00:00Z',
      now
    );

    expect(state).toEqual({
      location: { lat: 51.5, lon: -0.12 },
      locationName: 'London',
      motionMode: 'shadow',
      live: false,
      time: Date.parse('2026-12-21T12:00:00Z'),
      showArc: false,
      theme: 'dark',
    });
  });

  it('falls back safely for invalid motion and coordinates', () => {
    const state = parseHarnessState('?lat=100&lon=west&motion=both&theme=sepia', now);

    expect(state.location).toEqual({ lat: 42.3601, lon: -71.0589 });
    expect(state.locationName).toBe('Boston, MA');
    expect(state.motionMode).toBe('map');
    expect(state.theme).toBe('system');
  });
});
