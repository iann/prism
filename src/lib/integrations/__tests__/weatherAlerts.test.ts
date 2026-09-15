/**
 * Tests for the best-effort National Weather Service alert integration.
 */

export {};

jest.mock('@/components/widgets/WeatherWidget', () => ({}), { virtual: true });

const MOCK_NOW = Date.UTC(2026, 7, 7, 16, 0, 0);

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(MOCK_NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
});

function mockFetch(body: object, ok = true) {
  return jest.spyOn(global, 'fetch' as never).mockResolvedValue({
    ok,
    json: async () => body,
  } as never);
}

describe('fetchActiveWeatherAlerts', () => {
  it('requests active alerts for a coordinate and normalizes the NWS shape', async () => {
    const fetchSpy = mockFetch({
      features: [
        {
          id: 'https://api.weather.gov/alerts/urn:oid:test-alert',
          properties: {
            event: 'Heat Advisory',
            headline: 'Heat Advisory issued August 7 at noon EDT',
            description: 'Heat index values may become dangerous.',
            instruction: 'Drink plenty of fluids.',
            severity: 'Moderate',
            senderName: 'NWS Boston',
            effective: '2026-08-07T12:00:00-04:00',
            expires: '2026-08-07T20:00:00-04:00',
            status: 'Actual',
            messageType: 'Alert',
          },
        },
      ],
    });

    const { fetchActiveWeatherAlerts } = await import('../weatherAlerts');
    const alerts = await fetchActiveWeatherAlerts({ lat: 42.46, lon: -71.06 });

    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('point=42.46%2C-71.06');
    const requestInit = fetchSpy.mock.calls[0]?.[1] as unknown as {
      headers: Record<string, string>;
    };
    expect(requestInit.headers.Accept).toBe('application/geo+json');
    expect(requestInit.headers['User-Agent']).toContain('Prism-Family-Dashboard');

    expect(alerts).toEqual([
      {
        id: 'https://api.weather.gov/alerts/urn:oid:test-alert',
        title: 'Heat Advisory',
        headline: 'Heat Advisory issued August 7 at noon EDT',
        description: 'Heat index values may become dangerous.',
        instruction: 'Drink plenty of fluids.',
        severity: 'moderate',
        source: 'NWS Boston',
        start: new Date('2026-08-07T16:00:00.000Z'),
        end: new Date('2026-08-08T00:00:00.000Z'),
        url: 'https://api.weather.gov/alerts/urn:oid:test-alert',
      },
    ]);
  });

  it('sorts by severity and drops expired or non-actual products', async () => {
    mockFetch({
      features: [
        {
          id: 'minor',
          properties: {
            event: 'Special Weather Statement',
            severity: 'Minor',
            expires: '2026-08-07T15:00:00Z',
          },
        },
        {
          id: 'cancelled',
          properties: {
            event: 'Tornado Warning',
            severity: 'Extreme',
            status: 'Cancelled',
          },
        },
        {
          id: 'moderate',
          properties: {
            event: 'Flood Watch',
            severity: 'Moderate',
            expires: '2026-08-07T22:00:00Z',
          },
        },
        {
          id: 'severe',
          properties: {
            event: 'Severe Thunderstorm Warning',
            severity: 'Severe',
            expires: '2026-08-07T22:00:00Z',
          },
        },
      ],
    });

    const { fetchActiveWeatherAlerts } = await import('../weatherAlerts');
    const alerts = await fetchActiveWeatherAlerts({ lat: 40, lon: -75 });

    expect(alerts.map((alert) => alert.id)).toEqual(['severe', 'moderate']);
  });

  it('returns an empty list when NWS is unavailable or the location is unsupported', async () => {
    const fetchSpy = mockFetch({}, false);
    const { fetchActiveWeatherAlerts } = await import('../weatherAlerts');

    await expect(fetchActiveWeatherAlerts({ lat: 51.05, lon: 3.72 })).resolves.toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await expect(fetchActiveWeatherAlerts()).resolves.toEqual([]);
  });
});
