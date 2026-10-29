export {};

const mockStore = new Map<string, unknown>();

jest.mock('@/lib/cache/redis', () => ({
  getCache: jest.fn(async (key: string) => (mockStore.has(key) ? mockStore.get(key) : null)),
  setCache: jest.fn(async (key: string, value: unknown) => {
    mockStore.set(key, value);
  }),
}));

import {
  AIRGRADIENT_POLL_INTERVAL_MS,
  readAirGradient,
} from '../airgradientReading';

const T0 = new Date('2026-10-24T15:00:00Z').getTime();
const MEASUREMENT = { temperatureC: 21.5, humidity: 48, airQuality: { pm25: 4 } };

const originalEnv = process.env;

beforeEach(() => {
  mockStore.clear();
  process.env = { ...originalEnv, AIRGRADIENT_URL: 'http://sensor.local' };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('readAirGradient', () => {
  it('polls the monitor and reports the reading time', async () => {
    const fetchMeasurement = jest.fn().mockResolvedValue(MEASUREMENT);

    await expect(readAirGradient(fetchMeasurement, () => T0)).resolves.toEqual({
      status: 'fresh',
      measurement: MEASUREMENT,
      observedAt: new Date(T0),
    });
    expect(fetchMeasurement).toHaveBeenCalledTimes(1);
  });

  it('serves the snapshot without polling again inside the poll interval', async () => {
    const fetchMeasurement = jest.fn().mockResolvedValue(MEASUREMENT);

    await readAirGradient(fetchMeasurement, () => T0);
    const second = await readAirGradient(fetchMeasurement, () => T0 + 60_000);

    expect(second.status).toBe('fresh');
    expect(fetchMeasurement).toHaveBeenCalledTimes(1);
  });

  it('polls again once the poll interval has passed', async () => {
    const fetchMeasurement = jest.fn().mockResolvedValue(MEASUREMENT);

    await readAirGradient(fetchMeasurement, () => T0);
    await readAirGradient(fetchMeasurement, () => T0 + AIRGRADIENT_POLL_INTERVAL_MS + 1);

    expect(fetchMeasurement).toHaveBeenCalledTimes(2);
  });

  it('keeps the last reading when a poll fails inside the offline grace window', async () => {
    const fetchMeasurement = jest
      .fn()
      .mockResolvedValueOnce(MEASUREMENT)
      .mockRejectedValueOnce(new Error('network down'));

    await readAirGradient(fetchMeasurement, () => T0);
    const failed = await readAirGradient(fetchMeasurement, () => T0 + 6 * 60_000);

    expect(failed).toEqual({
      status: 'stale',
      measurement: MEASUREMENT,
      observedAt: new Date(T0),
    });
  });

  it('does not retry before the poll interval after a failed poll', async () => {
    const fetchMeasurement = jest
      .fn()
      .mockResolvedValueOnce(MEASUREMENT)
      .mockRejectedValueOnce(new Error('network down'));

    await readAirGradient(fetchMeasurement, () => T0);
    const failedAt = T0 + 6 * 60_000;
    await readAirGradient(fetchMeasurement, () => failedAt);
    await readAirGradient(fetchMeasurement, () => failedAt + 60_000);

    expect(fetchMeasurement).toHaveBeenCalledTimes(2);
  });

  it('reports offline with the poll error after the grace window', async () => {
    const error = new Error('network down');
    const fetchMeasurement = jest
      .fn()
      .mockResolvedValueOnce(MEASUREMENT)
      .mockRejectedValue(error);

    await readAirGradient(fetchMeasurement, () => T0);
    await readAirGradient(fetchMeasurement, () => T0 + 6 * 60_000);
    await readAirGradient(fetchMeasurement, () => T0 + 11 * 60_000);
    await readAirGradient(fetchMeasurement, () => T0 + 16 * 60_000);
    const failed = await readAirGradient(fetchMeasurement, () => T0 + 21 * 60_000);

    expect(failed).toEqual({ status: 'offline', error });
  });

  it('reports offline without a poll error for requests between attempts', async () => {
    const fetchMeasurement = jest
      .fn()
      .mockResolvedValueOnce(MEASUREMENT)
      .mockRejectedValue(new Error('network down'));

    await readAirGradient(fetchMeasurement, () => T0);
    await readAirGradient(fetchMeasurement, () => T0 + 6 * 60_000);
    await readAirGradient(fetchMeasurement, () => T0 + 11 * 60_000);
    await readAirGradient(fetchMeasurement, () => T0 + 16 * 60_000);
    await readAirGradient(fetchMeasurement, () => T0 + 21 * 60_000);
    const betweenPolls = await readAirGradient(fetchMeasurement, () => T0 + 22 * 60_000);

    expect(betweenPolls).toEqual({ status: 'offline' });
    expect(fetchMeasurement).toHaveBeenCalledTimes(5);
  });

  it('reports the outage error only on the poll that discovers it', async () => {
    const error = new Error('network down');
    const fetchMeasurement = jest
      .fn()
      .mockResolvedValueOnce(MEASUREMENT)
      .mockRejectedValue(error);

    await readAirGradient(fetchMeasurement, () => T0);
    await readAirGradient(fetchMeasurement, () => T0 + 6 * 60_000);
    await readAirGradient(fetchMeasurement, () => T0 + 11 * 60_000);
    await readAirGradient(fetchMeasurement, () => T0 + 16 * 60_000);
    const discovered = await readAirGradient(fetchMeasurement, () => T0 + 21 * 60_000);
    const retried = await readAirGradient(fetchMeasurement, () => T0 + 26 * 60_000);

    expect(discovered).toEqual({ status: 'offline', error });
    expect(retried).toEqual({ status: 'offline' });
  });

  it('counts a snapshot left behind for a long time as offline on the first failed poll', async () => {
    const error = new Error('network down');
    const fetchMeasurement = jest
      .fn()
      .mockResolvedValueOnce(MEASUREMENT)
      .mockRejectedValueOnce(error);

    await readAirGradient(fetchMeasurement, () => T0);
    const failed = await readAirGradient(fetchMeasurement, () => T0 + 60 * 60_000);

    expect(failed).toEqual({ status: 'offline', error });
  });

  it('reports offline on the first poll when there is no previous reading', async () => {
    const error = new Error('network down');
    const fetchMeasurement = jest.fn().mockRejectedValue(error);

    await expect(readAirGradient(fetchMeasurement, () => T0)).resolves.toEqual({
      status: 'offline',
      error,
    });
  });

  it('replaces a stale reading when the monitor recovers', async () => {
    const fresh = { temperatureC: 19, humidity: 55 };
    const fetchMeasurement = jest
      .fn()
      .mockResolvedValueOnce(MEASUREMENT)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(fresh);

    await readAirGradient(fetchMeasurement, () => T0);
    const failedAt = T0 + 6 * 60_000;
    await readAirGradient(fetchMeasurement, () => failedAt);
    const recovered = await readAirGradient(
      fetchMeasurement,
      () => failedAt + AIRGRADIENT_POLL_INTERVAL_MS + 1,
    );

    expect(recovered).toEqual({
      status: 'fresh',
      measurement: fresh,
      observedAt: new Date(failedAt + AIRGRADIENT_POLL_INTERVAL_MS + 1),
    });
  });
});
