import { getNWSConfig, DEFAULT_SEVERITY_FILTER } from '../nws-alerts';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  // Restore env after each test so mutations don't leak
  process.env = { ...ORIGINAL_ENV };
});

describe('getNWSConfig', () => {
  it('returns null when NWS_ZONE is not set', () => {
    delete process.env.NWS_ZONE;
    expect(getNWSConfig()).toBeNull();
  });

  it('returns config object when NWS_ZONE is set', () => {
    process.env.NWS_ZONE = 'MAZ015';
    const config = getNWSConfig();
    expect(config).not.toBeNull();
    expect(config?.zone).toBe('MAZ015');
  });

  it('uses default poll interval when NWS_POLL_INTERVAL_MS is not set', () => {
    process.env.NWS_ZONE = 'MAZ015';
    delete process.env.NWS_POLL_INTERVAL_MS;
    expect(getNWSConfig()?.pollIntervalMs).toBe(120_000);
  });

  it('parses a custom poll interval from env', () => {
    process.env.NWS_ZONE = 'MAZ015';
    process.env.NWS_POLL_INTERVAL_MS = '60000';
    expect(getNWSConfig()?.pollIntervalMs).toBe(60_000);
  });

  it('uses default severity filter when NWS_SEVERITY_FILTER is not set', () => {
    process.env.NWS_ZONE = 'MAZ015';
    delete process.env.NWS_SEVERITY_FILTER;
    expect(getNWSConfig()?.severityFilter).toEqual([...DEFAULT_SEVERITY_FILTER]);
  });

  it('parses a custom severity filter from env', () => {
    process.env.NWS_ZONE = 'MAZ015';
    process.env.NWS_SEVERITY_FILTER = 'Tornado Warning,Flash Flood Warning';
    expect(getNWSConfig()?.severityFilter).toEqual([
      'Tornado Warning',
      'Flash Flood Warning',
    ]);
  });

  it('trims whitespace in custom severity filter entries', () => {
    process.env.NWS_ZONE = 'MAZ015';
    process.env.NWS_SEVERITY_FILTER = ' Tornado Warning , Flash Flood Warning ';
    expect(getNWSConfig()?.severityFilter).toEqual([
      'Tornado Warning',
      'Flash Flood Warning',
    ]);
  });

  it('uses default radar center when lat/lon env vars are absent', () => {
    process.env.NWS_ZONE = 'MAZ015';
    delete process.env.NWS_RADAR_LAT;
    delete process.env.NWS_RADAR_LON;
    const config = getNWSConfig();
    expect(config?.radarCenter[0]).toBeCloseTo(38.9);
    expect(config?.radarCenter[1]).toBeCloseTo(-77.0);
  });

  it('reads custom radar center from env vars', () => {
    process.env.NWS_ZONE = 'MAZ015';
    process.env.NWS_RADAR_LAT = '42.36';
    process.env.NWS_RADAR_LON = '-71.06';
    const config = getNWSConfig();
    expect(config?.radarCenter[0]).toBeCloseTo(42.36);
    expect(config?.radarCenter[1]).toBeCloseTo(-71.06);
  });
});
