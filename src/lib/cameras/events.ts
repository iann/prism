import { createHash } from 'node:crypto';
import { getRedisClient } from '@/lib/cache/getRedisClient';

/**
 * Event delivery is intentionally separate from the camera stream controller.
 * Redis is the source of truth here: the process-local SSE listener is only a
 * delivery mechanism and may be recreated at any time.
 */
export const CAMERA_IDS = ['doorbell-1', 'doorbell-2', 'floodlight-1'] as const;
export type CameraId = (typeof CAMERA_IDS)[number];
export type CameraEventKind = 'doorbell' | 'motion';

export const CAMERA_EVENT_VERSION = 1;
export const CAMERA_EVENT_TTL_SECONDS = 30 * 60;
export const CAMERA_EVENT_MAX_AGE_MS = 60_000;
export const CAMERA_EVENT_MAX_FUTURE_MS = 10_000;
export const CAMERA_EVENT_BODY_LIMIT = 4 * 1024;
export const CAMERA_MOTION_COOLDOWN_MS = 10_000;
export const CAMERA_MOTION_DURATION_MS = 30_000;
export const CAMERA_RING_DURATION_MS = 60_000;
export const CAMERA_AUTO_EPISODE_LIMIT_MS = 120_000;

const ACTIVE_PREFIX = 'camera:event:active:';
const DEDUPE_PREFIX = 'camera:event:dedupe:';
const REVISION_KEY = 'camera:event:revision';
const CHANNEL = 'camera:event:changes';

export type CameraEventInput = {
  version: 1;
  eventId: string;
  cameraId: string;
  kind: CameraEventKind;
  occurredAt: string;
};

export type ActiveCameraEvent = {
  version: 1;
  eventId: string;
  /** The most recent source event is useful for diagnostics, but does not
   * replace eventId (the UI uses eventId for dismissal). */
  lastEventId?: string;
  cameraId: CameraId;
  cameraName?: string;
  kind: CameraEventKind;
  priority: 1 | 2;
  occurredAt: string;
  receivedAt: string;
  episodeStartedAt: string;
  lastActivityAt: string;
  expiresAt: string;
  eventCount: number;
  coalesced?: boolean;
};

export type CameraEventSnapshot = {
  revision: number;
  events: ActiveCameraEvent[];
};

export type PublishChange = {
  revision: number;
  event: ActiveCameraEvent;
};

export type CameraEventResult =
  | { accepted: true; duplicate: false; snapshot: CameraEventSnapshot; event: ActiveCameraEvent }
  | { accepted: true; duplicate: true; snapshot: CameraEventSnapshot; event?: ActiveCameraEvent }
  | { accepted: false; reason: 'conflict'; snapshot: CameraEventSnapshot };

export class CameraEventValidationError extends Error {
  readonly code = 'INVALID_CAMERA_EVENT';

  constructor(message: string) {
    super(message);
    this.name = 'CameraEventValidationError';
  }
}

export class CameraEventStoreUnavailableError extends Error {
  constructor() {
    super('Camera event coordination is unavailable');
    this.name = 'CameraEventStoreUnavailableError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCameraId(value: unknown, cameraIds: ReadonlySet<string>): value is CameraId {
  return typeof value === 'string' && cameraIds.has(value);
}

function parseDate(value: unknown, name: string): Date {
  if (typeof value !== 'string' || value.length > 80) {
    throw new CameraEventValidationError(`${name} must be an ISO-8601 string`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new CameraEventValidationError(`${name} must be an ISO-8601 string`);
  }
  return parsed;
}

/** Validate and normalize an HA payload. No caller-controlled entity or URL is accepted. */
export function validateCameraEvent(
  payload: unknown,
  options: { now?: number; cameraIds?: ReadonlySet<string> } = {},
): CameraEventInput {
  const value = isRecord(payload) ? payload : null;
  if (!value || value.version !== CAMERA_EVENT_VERSION) {
    throw new CameraEventValidationError('Unsupported event version');
  }

  const cameraIds = options.cameraIds ?? new Set<string>(CAMERA_IDS);
  if (!isCameraId(value.cameraId, cameraIds)) {
    throw new CameraEventValidationError('Unknown camera');
  }
  if (typeof value.eventId !== 'string' || !/^[\w:.\-]{1,160}$/.test(value.eventId)) {
    throw new CameraEventValidationError('eventId must be a short stable identifier');
  }
  if (value.kind !== 'doorbell' && value.kind !== 'motion') {
    throw new CameraEventValidationError('Unsupported event kind');
  }

  const occurredAt = parseDate(value.occurredAt, 'occurredAt');
  const now = options.now ?? Date.now();
  const time = occurredAt.getTime();
  if (time < now - CAMERA_EVENT_MAX_AGE_MS) {
    throw new CameraEventValidationError('Event is too old');
  }
  if (time > now + CAMERA_EVENT_MAX_FUTURE_MS) {
    throw new CameraEventValidationError('Event is too far in the future');
  }

  return {
    version: CAMERA_EVENT_VERSION,
    eventId: value.eventId,
    cameraId: value.cameraId,
    kind: value.kind,
    occurredAt: occurredAt.toISOString(),
  };
}

export function cameraEventDigest(event: CameraEventInput): string {
  return createHash('sha256')
    .update(`${event.version}\n${event.eventId}\n${event.cameraId}\n${event.kind}\n${event.occurredAt}`)
    .digest('hex');
}

function activeKey(cameraId: string): string {
  return `${ACTIVE_PREFIX}${cameraId}`;
}

function dedupeKey(ingressId: string, eventId: string): string {
  return `${DEDUPE_PREFIX}${ingressId}:${eventId}`;
}

function parseActive(value: string | null): ActiveCameraEvent | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as ActiveCameraEvent & { expiresAt: string | number };
    const expiresAtMs = typeof parsed.expiresAt === 'number'
      ? parsed.expiresAt
      : new Date(parsed.expiresAt).getTime();
    if (
      parsed?.version !== CAMERA_EVENT_VERSION ||
      typeof parsed.cameraId !== 'string' ||
      (parsed.kind !== 'doorbell' && parsed.kind !== 'motion') ||
      !Number.isFinite(expiresAtMs)
    ) return undefined;
    return { ...parsed, expiresAt: new Date(expiresAtMs).toISOString() };
  } catch {
    return undefined;
  }
}

function parseRevision(value: string | null): number {
  const revision = Number(value ?? 0);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

/**
 * This Lua transaction owns dedupe, reduction, revision allocation, active
 * state, and publication. Keeping those writes in one operation prevents a
 * duplicate HA retry from extending the card or publishing a half-committed
 * revision.
 */
const ACCEPT_EVENT_SCRIPT = `
local dedupe = redis.call('GET', KEYS[1])
if dedupe then
  if dedupe == ARGV[1] then
    local revision = redis.call('GET', KEYS[3]) or '0'
    local active = redis.call('GET', KEYS[2])
    return {2, revision, active or ''}
  end
  return {-1, redis.call('GET', KEYS[3]) or '0', ''}
end

local now = tonumber(ARGV[2])
local kind = ARGV[3]
local cameraId = ARGV[4]
local eventId = ARGV[5]
local occurredAt = ARGV[6]
local receivedAt = ARGV[7]
local duration = tonumber(ARGV[8])
local cooldown = tonumber(ARGV[9])
local episodeLimit = tonumber(ARGV[10])
local incomingPriority = (kind == 'doorbell') and 2 or 1
local oldRaw = redis.call('GET', KEYS[2])
local old = oldRaw and cjson.decode(oldRaw) or nil
local current = {
  version = 1,
  eventId = eventId,
  cameraId = cameraId,
  kind = kind,
  priority = incomingPriority,
  occurredAt = occurredAt,
  receivedAt = receivedAt,
  episodeStartedAt = receivedAt,
  lastActivityAt = receivedAt,
  expiresAt = receivedAt,
  eventCount = 1
}

if old and tonumber(old.expiresAtMs or 0) > now then
  local oldLast = tonumber(old.lastActivityAtMs or 0)
  local episodeStarted = tonumber(old.episodeStartedAtMs or now)
  local deadline = math.min(now + duration, episodeStarted + episodeLimit)
  current.episodeStartedAt = old.episodeStartedAt
  current.episodeStartedAtMs = episodeStarted
  current.lastActivityAt = receivedAt
  current.lastActivityAtMs = now
  current.expiresAtMs = deadline
  current.expiresAt = deadline
  current.eventCount = (tonumber(old.eventCount) or 1) + 1
  current.lastEventId = eventId

  if kind == 'motion' and old.kind == 'motion' and now - oldLast <= cooldown then
    current.eventId = old.eventId
    current.kind = old.kind
    current.priority = old.priority
    current.occurredAt = old.occurredAt
    current.receivedAt = old.receivedAt
    current.coalesced = true
  elseif incomingPriority < tonumber(old.priority or 1) then
    deadline = math.max(tonumber(old.expiresAtMs or 0), deadline)
    current.expiresAtMs = deadline
    current.expiresAt = deadline
    current.eventId = old.eventId
    current.kind = old.kind
    current.priority = old.priority
    current.occurredAt = old.occurredAt
    current.receivedAt = old.receivedAt
  end
else
  current.expiresAtMs = now + duration
  current.expiresAt = current.expiresAtMs
  current.episodeStartedAtMs = now
  current.lastActivityAtMs = now
end

current.expiresAtMs = tonumber(current.expiresAtMs)
current.episodeStartedAtMs = tonumber(current.episodeStartedAtMs)
current.lastActivityAtMs = tonumber(current.lastActivityAtMs)
local ttl = math.max(1, math.ceil((current.expiresAtMs - now) / 1000))
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[11])
redis.call('SET', KEYS[2], cjson.encode(current), 'EX', ttl)
local revision = redis.call('INCR', KEYS[3])
local published = cjson.encode({revision = revision, event = current})
redis.call('PUBLISH', ARGV[12], published)
return {1, tostring(revision), cjson.encode(current)}
`;

function resultEvent(raw: string | undefined): ActiveCameraEvent | undefined {
  return parseActive(raw ?? null);
}

function redisResultPart(result: unknown, index: number): string {
  if (!Array.isArray(result)) return '';
  const value = result[index];
  return typeof value === 'string' ? value : String(value ?? '');
}

function makeSnapshot(revision: number, events: ActiveCameraEvent[]): CameraEventSnapshot {
  return { revision, events: events.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
  }) };
}

export async function getCameraEventSnapshot(
  cameraIds: ReadonlySet<string> = new Set<string>(CAMERA_IDS),
  now = Date.now(),
): Promise<CameraEventSnapshot> {
  const client = await getRedisClient();
  if (!client) throw new CameraEventStoreUnavailableError();
  try {
    const ids = [...cameraIds];
    const [revisionRaw, values] = await Promise.all([
      client.get(REVISION_KEY),
      ids.length ? client.mGet(ids.map(activeKey)) : Promise.resolve([]),
    ]);
    const events: ActiveCameraEvent[] = [];
    for (let index = 0; index < values.length; index += 1) {
      const event = parseActive(values[index] ?? null);
      if (!event) continue;
      if (new Date(event.expiresAt).getTime() <= now) continue;
      events.push(event);
    }
    return makeSnapshot(parseRevision(revisionRaw), events);
  } catch (error) {
    if (error instanceof CameraEventStoreUnavailableError) throw error;
    throw new CameraEventStoreUnavailableError();
  }
}

export async function acceptCameraEvent(
  input: CameraEventInput,
  ingressId: string,
  options: { now?: number; cameraIds?: ReadonlySet<string> } = {},
): Promise<CameraEventResult> {
  const normalized = validateCameraEvent(input, options);
  if (!ingressId || !/^[\w:.\-]{1,160}$/.test(ingressId)) {
    throw new CameraEventValidationError('Invalid ingress identity');
  }
  const client = await getRedisClient();
  if (!client) throw new CameraEventStoreUnavailableError();

  const now = options.now ?? Date.now();
  const receivedAt = new Date(now).toISOString();
  const digest = cameraEventDigest(normalized);
  let result: unknown;
  try {
    result = await client.eval(ACCEPT_EVENT_SCRIPT, {
      keys: [dedupeKey(ingressId, normalized.eventId), activeKey(normalized.cameraId), REVISION_KEY],
      arguments: [
        digest,
        String(now),
        normalized.kind,
        normalized.cameraId,
        normalized.eventId,
        normalized.occurredAt,
        receivedAt,
        String(normalized.kind === 'doorbell' ? CAMERA_RING_DURATION_MS : CAMERA_MOTION_DURATION_MS),
        String(CAMERA_MOTION_COOLDOWN_MS),
        String(CAMERA_AUTO_EPISODE_LIMIT_MS),
        String(CAMERA_EVENT_TTL_SECONDS),
        CHANNEL,
      ],
    });
  } catch {
    throw new CameraEventStoreUnavailableError();
  }

  const status = Number(redisResultPart(result, 0));
  const revision = parseRevision(redisResultPart(result, 1));
  const event = resultEvent(redisResultPart(result, 2));
  const snapshot = await getCameraEventSnapshot(options.cameraIds, now);
  if (status === -1) return { accepted: false, reason: 'conflict', snapshot };
  if (status === 2) return { accepted: true, duplicate: true, snapshot, event };
  if (status !== 1 || !event) throw new CameraEventStoreUnavailableError();
  // The snapshot read is deliberately after the transaction. It closes the
  // small gap where a subscriber reconnects between publish and its snapshot.
  return { accepted: true, duplicate: false, snapshot: { ...snapshot, revision: Math.max(snapshot.revision, revision) }, event };
}

export async function subscribeToCameraEvents(
  listener: (change: PublishChange) => void,
): Promise<() => Promise<void>> {
  const client = await getRedisClient();
  if (!client) throw new CameraEventStoreUnavailableError();
  const subscriber = client.duplicate();
  try {
    await subscriber.connect();
    await subscriber.subscribe(CHANNEL, (message) => {
      try {
        const parsed = JSON.parse(message) as PublishChange;
        if (Number.isSafeInteger(parsed.revision) && parsed.event) listener(parsed);
      } catch {
        // A malformed pub/sub message cannot be allowed to break an SSE stream.
      }
    });
  } catch {
    subscriber.destroy();
    throw new CameraEventStoreUnavailableError();
  }

  return async () => {
    try {
      await subscriber.unsubscribe(CHANNEL);
    } catch {
      // The connection may already have been closed by the request runtime.
    }
    subscriber.destroy();
  };
}

export function eventIsVisibleForCamera(event: ActiveCameraEvent, cameraIds: ReadonlySet<string>): boolean {
  return cameraIds.has(event.cameraId) && new Date(event.expiresAt).getTime() > Date.now();
}
