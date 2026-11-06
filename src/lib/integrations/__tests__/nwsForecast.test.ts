/**
 * Tests for the best-effort National Weather Service narrative forecast.
 */

export {};

jest.mock('@/components/widgets/WeatherWidget', () => ({}), { virtual: true });

const FORECAST_URL = 'https://api.weather.gov/gridpoints/BOX/71,106/forecast';

function mockJson(body: object, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
});

describe('fetchWeatherOutlook', () => {
  it('resolves the point grid, keeps daytime periods, and limits the outlook to three days', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValueOnce(
        mockJson({
          properties: { forecast: FORECAST_URL },
        }) as never,
      )
      .mockResolvedValueOnce(
        mockJson({
          properties: {
            periods: [
              {
                name: 'Today',
                startTime: '2026-11-06T06:00:00-05:00',
                isDaytime: true,
                shortForecast: 'Rain',
                detailedForecast:
                  'Rain and a chance of thunderstorms. Cloudy, with a high near 69. South wind around 7 mph.',
              },
              {
                name: 'Tonight',
                startTime: '2026-11-06T18:00:00-05:00',
                isDaytime: false,
                shortForecast: 'Heavy Rain',
                detailedForecast: 'Rain. Cloudy, with a low around 55.',
              },
              {
                name: 'Saturday',
                startTime: '2026-11-07T06:00:00-05:00',
                isDaytime: true,
                shortForecast: 'Light Rain Likely then Patchy Fog',
                detailedForecast: 'Rain likely and patchy fog before 10am. Partly sunny.',
              },
              {
                name: 'Sunday',
                startTime: '2026-11-08T06:00:00-05:00',
                isDaytime: true,
                shortForecast: 'Mostly Sunny',
                detailedForecast: 'Mostly sunny, with a high near 57.',
              },
              {
                name: 'Monday',
                startTime: '2026-11-09T06:00:00-05:00',
                isDaytime: true,
                shortForecast: 'Sunny',
                detailedForecast: 'Sunny, with a high near 57.',
              },
            ],
          },
        }) as never,
      );

    const { fetchWeatherOutlook } = await import('../nwsForecast');
    const outlook = await fetchWeatherOutlook({ lat: 42.46, lon: -71.06 });

    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      'https://api.weather.gov/points/42.4600,-71.0600',
    );
    expect(String(fetchSpy.mock.calls[1]?.[0])).toBe(FORECAST_URL);

    const requestInit = fetchSpy.mock.calls[0]?.[1] as unknown as {
      headers: Record<string, string>;
    };
    expect(requestInit.headers.Accept).toBe('application/geo+json');
    expect(requestInit.headers['User-Agent']).toContain('Prism-Family-Dashboard');

    expect(outlook).toEqual([
      {
        day: 'Today',
        start: '2026-11-06T06:00:00-05:00',
        short: 'Rain',
        detail: 'Rain and a chance of thunderstorms.',
      },
      {
        day: 'Saturday',
        start: '2026-11-07T06:00:00-05:00',
        short: 'Light Rain Likely then Patchy Fog',
        detail: 'Rain likely and patchy fog before 10am.',
      },
      {
        day: 'Sunday',
        start: '2026-11-08T06:00:00-05:00',
        short: 'Mostly Sunny',
        detail: 'Mostly sunny, with a high near 57.',
      },
    ]);
  });

  it('returns an empty outlook when the location is unsupported or NWS is unavailable', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValueOnce(mockJson({}, false) as never);

    const { fetchWeatherOutlook } = await import('../nwsForecast');

    await expect(fetchWeatherOutlook({ lat: 51.05, lon: 3.72 })).resolves.toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await expect(fetchWeatherOutlook()).resolves.toEqual([]);
    await expect(fetchWeatherOutlook({ lat: Number.NaN, lon: 0 })).resolves.toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns an empty outlook when the forecast request fails', async () => {
    jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValueOnce(mockJson({ properties: { forecast: FORECAST_URL } }) as never)
      .mockResolvedValueOnce(mockJson({}, false) as never);

    const { fetchWeatherOutlook } = await import('../nwsForecast');
    await expect(fetchWeatherOutlook({ lat: 42.46, lon: -71.06 })).resolves.toEqual([]);
  });

  it('drops blank periods and survives malformed payloads', async () => {
    jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValueOnce(
        mockJson({
          properties: {
            forecast: FORECAST_URL,
          },
        }) as never,
      )
      .mockResolvedValueOnce(
        mockJson({
          properties: {
            periods: [
              { name: 'Today', isDaytime: true },
              { name: 'Saturday', isDaytime: true, shortForecast: '  Rain   likely  ' },
            ],
          },
        }) as never,
      );

    const { fetchWeatherOutlook } = await import('../nwsForecast');
    await expect(fetchWeatherOutlook({ lat: 42.46, lon: -71.06 })).resolves.toEqual([
      {
        day: 'Saturday',
        start: '',
        short: 'Rain likely',
        detail: '',
      },
    ]);
  });
});
