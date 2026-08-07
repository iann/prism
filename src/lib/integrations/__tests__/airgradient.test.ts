export {}; // module marker so const declarations don't leak into global scope

jest.mock('@/components/widgets/WeatherWidget', () => ({}), { virtual: true });

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv, AIRGRADIENT_URL: 'http://sensor.local/' };
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = originalEnv;
});

describe('AirGradient integration', () => {
  it('reads the local temperature, humidity, and air-quality values', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        atmp: 25.99,
        atmpCompensated: 25.59,
        rhum: 68.57,
        rhumCompensated: 93.67,
        pm02: 27,
        pm10: 27.83,
        rco2: 472,
        tvocIndex: 157,
        noxIndex: 1,
      }),
    } as never);

    const { fetchAirGradientMeasurement } = await import('../airgradient');
    await expect(fetchAirGradientMeasurement()).resolves.toEqual({
      temperatureC: 25.99,
      humidity: 68.57,
      airQuality: {
        pm25: 27,
        pm10: 27.8,
        co2: 472,
        tvocIndex: 157,
        noxIndex: 1,
      },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://sensor.local/measures/current',
      expect.objectContaining({
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('falls back to compensated readings when raw values are invalid', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ atmp: null, atmpCompensated: 20.5, rhum: 140, rhumCompensated: 55 }),
    } as never);

    const { fetchAirGradientMeasurement } = await import('../airgradient');
    await expect(fetchAirGradientMeasurement()).resolves.toMatchObject({
      temperatureC: 20.5,
      humidity: 55,
    });
  });

  it('rejects a response without a valid temperature', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ rhum: 55 }),
    } as never);

    const { fetchAirGradientMeasurement } = await import('../airgradient');
    await expect(fetchAirGradientMeasurement()).rejects.toThrow('valid temperature');
  });

  it('uses the local readings to derive the current display values', async () => {
    const { applyAirGradientCurrent, calculateFeelsLikeF } = await import('../airgradient');
    const baseWeather = {
      location: 'Melrose, MA',
      current: {
        temperature: 81,
        feelsLike: 91,
        condition: 'cloudy' as const,
        humidity: 85,
        windSpeed: 3,
        description: 'Overcast',
      },
      forecast: [],
      units: { temperature: 'F' as const, windSpeed: 'mph' as const, precipitation: 'in' as const },
      lastUpdated: new Date('2026-08-07T00:00:00Z'),
    };

    const result = applyAirGradientCurrent(
      baseWeather,
      {
        temperatureC: 25.99,
        humidity: 68.57,
        airQuality: { pm25: 27 },
      },
      baseWeather.units
    );

    expect(result.current.temperature).toBe(79);
    expect(result.current.humidity).toBe(69);
    expect(result.current.feelsLike).toBe(calculateFeelsLikeF(78.782, 68.57, 3));
    expect(result.current.airQuality).toEqual({ pm25: 27 });
    expect(result.current.description).toBe('Overcast');
  });
});
