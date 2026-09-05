import {
  acceptCameraEvent,
  cameraEventDigest,
  CameraEventValidationError,
  getCameraEventSnapshot,
  validateCameraEvent,
} from '../events';

const getRedisClient = jest.fn();
jest.mock('@/lib/cache/getRedisClient', () => ({ getRedisClient: (...args: unknown[]) => getRedisClient(...args) }));

const NOW = Date.parse('2026-09-05T18:30:00.000Z');

type FakeRedis = {
  get: jest.Mock;
  mGet: jest.Mock;
  del: jest.Mock;
  eval: jest.Mock;
};

function makeFakeRedis(): FakeRedis {
  const strings = new Map<string, string>();
  let revision = 0;
  const fake: FakeRedis = {
    get: jest.fn(async (key: string) => key === 'camera:event:revision' ? String(revision) : strings.get(key) ?? null),
    mGet: jest.fn(async (keys: string[]) => keys.map((key) => strings.get(key) ?? null)),
    del: jest.fn(async (key: string) => { strings.delete(key); return 1; }),
    eval: jest.fn(async (_script: string, options: { keys: string[]; arguments: string[] }) => {
      const [dedupeKey, activeKey] = options.keys as [string, string];
      const [digest, nowRaw, kind, cameraId, eventId, occurredAt, receivedAt, durationRaw] = options.arguments as [string, string, string, string, string, string, string, string];
      const existingDigest = strings.get(dedupeKey);
      if (existingDigest) {
        const active = strings.get(activeKey) ?? '';
        return [existingDigest === digest ? 2 : -1, String(revision), active];
      }
      const now = Number(nowRaw);
      const old = strings.get(activeKey) ? JSON.parse(strings.get(activeKey)!) : undefined;
      const duration = Number(durationRaw);
      const oldActive = old && Date.parse(old.expiresAt) > now ? old : undefined;
      const isMotionCoalesce = oldActive?.kind === 'motion' && kind === 'motion'
        && now - Date.parse(oldActive.lastActivityAt) <= 10_000;
      const expires = Math.min(
        now + duration,
        oldActive ? Date.parse(oldActive.episodeStartedAt) + 120_000 : now + duration,
      );
      const event = {
        version: 1,
        eventId: isMotionCoalesce ? oldActive.eventId : eventId,
        lastEventId: isMotionCoalesce ? eventId : undefined,
        cameraId,
        kind: isMotionCoalesce ? oldActive.kind : kind,
        priority: (isMotionCoalesce ? oldActive.priority : kind === 'doorbell' ? 2 : 1),
        occurredAt: isMotionCoalesce ? oldActive.occurredAt : occurredAt,
        receivedAt: isMotionCoalesce ? oldActive.receivedAt : receivedAt,
        episodeStartedAt: isMotionCoalesce ? oldActive.episodeStartedAt : receivedAt,
        lastActivityAt: receivedAt,
        expiresAt: new Date(expires).toISOString(),
        eventCount: (oldActive?.eventCount ?? 0) + 1,
        coalesced: isMotionCoalesce ? true : undefined,
      };
      strings.set(dedupeKey, digest);
      strings.set(activeKey, JSON.stringify(event));
      revision += 1;
      return [1, String(revision), JSON.stringify(event)];
    }),
  };
  return fake;
}

function input(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    version: 1,
    eventId: 'ha:doorbell-1:1',
    cameraId: 'doorbell-1',
    kind: 'doorbell',
    occurredAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getRedisClient.mockResolvedValue(makeFakeRedis());
});

describe('camera event validation', () => {
  it('normalizes valid input and rejects unknown or caller-controlled fields', () => {
    expect(validateCameraEvent(input(), { now: NOW })).toEqual(input());
    expect(() => validateCameraEvent(input({ cameraId: 'garage' }), { now: NOW })).toThrow(CameraEventValidationError);
    expect(() => validateCameraEvent(input({ version: 2 }), { now: NOW })).toThrow('Unsupported event version');
    expect(() => validateCameraEvent(input({ occurredAt: new Date(NOW - 61_000).toISOString() }), { now: NOW })).toThrow('too old');
    expect(() => validateCameraEvent(input({ occurredAt: new Date(NOW + 11_000).toISOString() }), { now: NOW })).toThrow('future');
  });

  it('uses a stable digest for retries and changes it for a conflicting payload', () => {
    const first = validateCameraEvent(input(), { now: NOW });
    const same = validateCameraEvent(input(), { now: NOW });
    const changed = validateCameraEvent(input({ kind: 'motion' }), { now: NOW });
    expect(cameraEventDigest(first)).toBe(cameraEventDigest(same));
    expect(cameraEventDigest(first)).not.toBe(cameraEventDigest(changed));
  });
});

describe('camera event Redis contract', () => {
  it('accepts a fresh event, makes retries idempotent, and rejects conflicting reuse', async () => {
    const first = await acceptCameraEvent(validateCameraEvent(input(), { now: NOW }), 'ingress-a', { now: NOW });
    const duplicate = await acceptCameraEvent(validateCameraEvent(input(), { now: NOW }), 'ingress-a', { now: NOW });
    const conflict = await acceptCameraEvent(
      validateCameraEvent(input({ kind: 'motion' }), { now: NOW }),
      'ingress-a',
      { now: NOW },
    );

    expect(first).toMatchObject({ accepted: true, duplicate: false, snapshot: { revision: 1 } });
    expect(duplicate).toMatchObject({ accepted: true, duplicate: true, snapshot: { revision: 1 } });
    expect(conflict).toMatchObject({ accepted: false, reason: 'conflict', snapshot: { revision: 1 } });
  });

  it('coalesces repeated motion without replacing the UI event ID', async () => {
    const first = await acceptCameraEvent(
      validateCameraEvent(input({ kind: 'motion', eventId: 'motion-1' }), { now: NOW }),
      'ingress-a',
      { now: NOW },
    );
    const second = await acceptCameraEvent(
      validateCameraEvent(input({ kind: 'motion', eventId: 'motion-2', occurredAt: new Date(NOW + 5_000).toISOString() }), { now: NOW + 5_000 }),
      'ingress-a',
      { now: NOW + 5_000 },
    );

    expect(first).toMatchObject({ event: { eventId: 'motion-1' } });
    expect(second).toMatchObject({ event: { eventId: 'motion-1', lastEventId: 'motion-2', coalesced: true, eventCount: 2 } });
  });

  it('returns only unexpired active events from the recovery snapshot', async () => {
    const first = await acceptCameraEvent(validateCameraEvent(input(), { now: NOW }), 'ingress-a', { now: NOW });
    expect(first.snapshot.events).toHaveLength(1);
    const snapshot = await getCameraEventSnapshot(undefined, NOW + 61_000);
    expect(snapshot.events).toHaveLength(0);
  });
});
