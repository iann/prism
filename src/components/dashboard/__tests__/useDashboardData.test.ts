import { DASHBOARD_POLL_OFFSETS, getEnabledDashboardDomains } from '../useDashboardData';

describe('getEnabledDashboardDomains', () => {
  it('loads no widget domains until the active layout is known', () => {
    expect([...getEnabledDashboardDomains()]).toEqual([]);
    expect([...getEnabledDashboardDomains(new Set())]).toEqual([]);
  });

  it('loads only the domains required by visible widgets', () => {
    expect(
      [...getEnabledDashboardDomains(new Set(['weather', 'tasks']))].sort()
    ).toEqual(['tasks', 'weather']);
  });

  it('loads both goal and point data for the points widget', () => {
    expect(
      [...getEnabledDashboardDomains(new Set(['points']))].sort()
    ).toEqual(['goals', 'points']);
  });
});

describe('DASHBOARD_POLL_OFFSETS', () => {
  it('spreads the five-minute dashboard pollers across the minute', () => {
    expect([
      DASHBOARD_POLL_OFFSETS.weather,
      DASHBOARD_POLL_OFFSETS.tasks,
      DASHBOARD_POLL_OFFSETS.chores,
      DASHBOARD_POLL_OFFSETS.shopping,
      DASHBOARD_POLL_OFFSETS.meals,
      DASHBOARD_POLL_OFFSETS.calendar,
    ]).toEqual([0, 10_000, 20_000, 30_000, 40_000, 50_000]);
  });
});
