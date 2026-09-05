import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { db } from '@/lib/db/client';
import { cameraStreamCleanup } from '@/lib/db/schema';
import {
  getHomeAssistantCameraConfig,
  homeAssistantCameraFetch,
  type CameraMapping,
} from '@/lib/integrations/homeAssistantCameraCredentials';

export const CAMERA_SESSION_TTL_SECONDS = 330;
export const CAMERA_SESSION_HEARTBEAT_SECONDS = 15;
export const CAMERA_SESSION_IDLE_SECONDS = 45;
export const CAMERA_SESSION_MAX_MS = 5 * 60 * 1000;

const SESSION_PREFIX = 'camera:session:';
const CAMERA_LOCK_PREFIX = 'camera:stream-lock:';
const CAMERA_VIEWER_PREFIX = 'camera:viewer-count:';

export type CameraSessionState = 'connecting' | 'ready' | 'released' | 'expired' | 'unavailable';

export type CameraSession = {
  id: string;
  cameraId: string;
  grantId: string;
  alias: string;
  entityId: string;
  state: CameraSessionState;
  createdAt: string;
  lastHeartbeatAt: string;
  hardDeadline: string;
  ownedUpstream: boolean;
  cleanupId: string;
};

export class CameraSessionError extends Error {
  readonly code: 'unavailable' | 'invalid' | 'not_found' | 'upstream';

  constructor(code: CameraSessionError['code'], message: string) {
    super(message);
    this.name = 'CameraSessionError';
    this.code = code;
  }
}

function sessionKey(id: string) {
  return `${SESSION_PREFIX}${id}`;
}

function viewerCountKey(cameraId: string) {
  return `${CAMERA_VIEWER_PREFIX}${cameraId}`;
}

function asSession(value: string | null): CameraSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as CameraSession;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.cameraId !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function findOpenCleanupId(cameraId: string): Promise<string> {
  const [row] = await db.select({ id: cameraStreamCleanup.id })
    .from(cameraStreamCleanup)
    .where(and(
      eq(cameraStreamCleanup.cameraId, cameraId),
      inArray(cameraStreamCleanup.state, ['pending', 'active', 'failed']),
    ))
    .orderBy(desc(cameraStreamCleanup.createdAt))
    .limit(1);
  return row?.id ?? '';
}

async function scheduleCleanupWhenIdle(session: CameraSession): Promise<void> {
  const cleanupId = session.cleanupId || await findOpenCleanupId(session.cameraId);
  if (!cleanupId) return;
  await db.update(cameraStreamCleanup).set({ state: 'pending', hardDeadline: new Date(), updatedAt: new Date() })
    .where(eq(cameraStreamCleanup.id, cleanupId));
}

export async function getCameraMapping(cameraId: string): Promise<CameraMapping> {
  const config = await getHomeAssistantCameraConfig();
  const mapping = config?.enabled
    ? config.cameras.find((camera) => camera.enabled && camera.id === cameraId)
    : undefined;
  if (!mapping) throw new CameraSessionError('invalid', 'Camera is not configured');
  if (!mapping.go2rtcAlias) throw new CameraSessionError('unavailable', 'Live video is not configured for this camera');
  return mapping;
}

export async function getCameraSession(id: string): Promise<CameraSession | null> {
  const client = await getRedisClient();
  if (!client) throw new CameraSessionError('unavailable', 'Camera session coordination unavailable');
  const session = asSession(await client.get(sessionKey(id)));
  if (session && Date.now() - Date.parse(session.lastHeartbeatAt) > CAMERA_SESSION_IDLE_SECONDS * 1000) {
    const removed = await client.del(sessionKey(id));
    if (removed) {
      const remaining = Math.max(0, await client.decr(viewerCountKey(session.cameraId)));
      if (remaining === 0) await scheduleCleanupWhenIdle(session).catch(() => undefined);
    }
    return null;
  }
  return session;
}

/**
 * Create a short-lived viewer lease. The Eufy P2P start is deliberately kept
 * outside this function so an event card can render before a slow camera
 * connection completes.
 */
export async function createCameraSession(cameraId: string, grantId: string): Promise<CameraSession> {
  const mapping = await getCameraMapping(cameraId);
  const client = await getRedisClient();
  if (!client) throw new CameraSessionError('unavailable', 'Camera session coordination unavailable');

  const now = new Date();
  const viewerCount = await client.incr(viewerCountKey(cameraId));
  await client.expire(viewerCountKey(cameraId), CAMERA_SESSION_TTL_SECONDS);
  const ownsUpstream = viewerCount === 1;
  const session: CameraSession = {
    id: randomUUID(),
    cameraId,
    grantId,
    alias: mapping.go2rtcAlias!,
    entityId: mapping.haCameraEntityId,
    state: 'connecting',
    createdAt: now.toISOString(),
    lastHeartbeatAt: now.toISOString(),
    hardDeadline: new Date(now.getTime() + CAMERA_SESSION_MAX_MS).toISOString(),
    ownedUpstream: ownsUpstream,
    cleanupId: '',
  };
  if (ownsUpstream) {
    try {
      const [cleanup] = await db.insert(cameraStreamCleanup).values({
        cameraId,
        generation: Math.floor(Math.random() * 2_000_000_000),
        state: 'pending',
        hardDeadline: new Date(now.getTime() + CAMERA_SESSION_MAX_MS),
        mapping: { cameraId, haCameraEntityId: mapping.haCameraEntityId },
      }).returning({ id: cameraStreamCleanup.id });
      if (!cleanup) throw new Error('No cleanup row returned');
      session.cleanupId = cleanup.id;
    } catch {
      await client.decr(viewerCountKey(cameraId));
      throw new CameraSessionError('unavailable', 'Unable to record camera stream ownership');
    }
  } else {
    session.cleanupId = await findOpenCleanupId(cameraId);
  }
  try {
    await client.set(sessionKey(session.id), JSON.stringify(session), { EX: CAMERA_SESSION_TTL_SECONDS });
  } catch {
    const remaining = Math.max(0, await client.decr(viewerCountKey(cameraId)));
    if (remaining === 0 && session.cleanupId) await scheduleCleanupWhenIdle(session).catch(() => undefined);
    throw new CameraSessionError('unavailable', 'Unable to create camera session');
  }
  return session;
}

export async function updateCameraSession(
  id: string,
  grantId: string,
  update: Partial<Pick<CameraSession, 'state' | 'ownedUpstream'>> = {},
): Promise<CameraSession> {
  const client = await getRedisClient();
  if (!client) throw new CameraSessionError('unavailable', 'Camera session coordination unavailable');
  const session = asSession(await client.get(sessionKey(id)));
  if (!session || session.grantId !== grantId) throw new CameraSessionError('not_found', 'Camera session not found');
  const now = Date.now();
  if (Date.parse(session.hardDeadline) <= now) {
    await client.del(sessionKey(id));
    throw new CameraSessionError('not_found', 'Camera session expired');
  }
  const next: CameraSession = {
    ...session,
    ...update,
    lastHeartbeatAt: new Date(now).toISOString(),
  };
  const remainingSeconds = Math.max(1, Math.ceil((Date.parse(next.hardDeadline) - now) / 1000));
  await client.set(sessionKey(id), JSON.stringify(next), { EX: Math.min(CAMERA_SESSION_TTL_SECONDS, remainingSeconds) });
  if (update.state && next.cleanupId) {
    await db.update(cameraStreamCleanup).set({ state: update.state === 'ready' ? 'active' : update.state === 'released' ? 'released' : 'pending', updatedAt: new Date() }).where(eq(cameraStreamCleanup.id, next.cleanupId));
  }
  return next;
}

export async function releaseCameraSession(id: string, grantId: string): Promise<CameraSession | null> {
  const client = await getRedisClient();
  if (!client) throw new CameraSessionError('unavailable', 'Camera session coordination unavailable');
  const session = asSession(await client.get(sessionKey(id)));
  if (!session || session.grantId !== grantId) return null;
  await client.del(sessionKey(id));
  const remaining = Math.max(0, await client.decr(viewerCountKey(session.cameraId)));
  const shouldStopUpstream = remaining === 0;
  const cleanupId = session.cleanupId || await findOpenCleanupId(session.cameraId);
  return { ...session, state: 'released', ownedUpstream: shouldStopUpstream, cleanupId, lastHeartbeatAt: new Date().toISOString() };
}

export async function withCameraStartLock<T>(cameraId: string, action: () => Promise<T>): Promise<T> {
  const client = await getRedisClient();
  if (!client) throw new CameraSessionError('unavailable', 'Camera session coordination unavailable');
  const lockKey = `${CAMERA_LOCK_PREFIX}${cameraId}`;
  const lockValue = randomUUID();
  const locked = await client.set(lockKey, lockValue, { NX: true, EX: 20 });
  if (locked !== 'OK') throw new CameraSessionError('upstream', 'Camera stream is already starting or stopping');
  try {
    return await action();
  } finally {
    const current = await client.get(lockKey);
    if (current === lockValue) await client.del(lockKey);
  }
}

export async function startP2PLivestream(mapping: CameraMapping): Promise<void> {
  const config = await getHomeAssistantCameraConfig();
  if (!config) throw new CameraSessionError('unavailable', 'Home Assistant camera configuration is missing');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await homeAssistantCameraFetch(config, '/api/services/camera/start_p2p_livestream', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({ entity_id: mapping.haCameraEntityId }),
      signal: controller.signal,
    });
    if (!response.ok) throw new CameraSessionError('upstream', 'Home Assistant could not start the camera stream');
  } catch (error) {
    if (error instanceof CameraSessionError) throw error;
    throw new CameraSessionError('upstream', 'Home Assistant camera stream request failed');
  } finally {
    clearTimeout(timeout);
  }
}

export async function markCameraCleanupFailed(session: CameraSession, message: string): Promise<void> {
  const cleanupId = session.cleanupId || await findOpenCleanupId(session.cameraId);
  if (!cleanupId) return;
  await db.update(cameraStreamCleanup).set({ state: 'failed', hardDeadline: new Date(), lastError: message.slice(0, 500), updatedAt: new Date() }).where(eq(cameraStreamCleanup.id, cleanupId));
}

export async function markCameraCleanupReleased(session: CameraSession): Promise<void> {
  const cleanupId = session.cleanupId || await findOpenCleanupId(session.cameraId);
  if (!cleanupId) return;
  await db.update(cameraStreamCleanup).set({ state: 'released', lastError: null, updatedAt: new Date() }).where(eq(cameraStreamCleanup.id, cleanupId));
}

/** Stop every durable stream lease before credentials are removed. */
export async function stopActiveCameraStreams(): Promise<void> {
  let rows;
  try {
    rows = await db.select().from(cameraStreamCleanup).where(
      inArray(cameraStreamCleanup.state, ['pending', 'active', 'failed', 'stopping']),
    );
  } catch (error) {
    if (error instanceof Error && /relation [^ ]*camera_stream_cleanup[^ ]* does not exist/.test(error.message)) return;
    throw error;
  }
  for (const row of rows) {
    const mapping = row.mapping && typeof row.mapping === 'object' ? row.mapping as { haCameraEntityId?: unknown } : {};
    if (typeof mapping.haCameraEntityId !== 'string') {
      await db.update(cameraStreamCleanup).set({ state: 'failed', lastError: 'Cleanup mapping is invalid', updatedAt: new Date() }).where(eq(cameraStreamCleanup.id, row.id));
      throw new CameraSessionError('upstream', 'A camera stream has an invalid cleanup mapping');
    }
    const entityId = mapping.haCameraEntityId;
    try {
      await withCameraStartLock(row.cameraId, () => stopP2PLivestream({ id: row.cameraId, name: row.cameraId, enabled: true, haCameraEntityId: entityId, ringEntityId: null, motionEntityId: null, pictureEntityId: null, go2rtcAlias: null, targetDisplayId: null, eventKinds: ['motion'] }));
      await db.update(cameraStreamCleanup).set({ state: 'released', lastError: null, updatedAt: new Date() }).where(eq(cameraStreamCleanup.id, row.id));
    } catch (error) {
      await db.update(cameraStreamCleanup).set({ state: 'failed', lastError: error instanceof Error ? error.message.slice(0, 500) : 'Camera stream stop failed', updatedAt: new Date() }).where(eq(cameraStreamCleanup.id, row.id));
      throw error;
    }
  }
}

export async function runCameraCleanupOnce(): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  const lockValue = randomUUID();
  const locked = await client.set('camera:cleanup-leader', lockValue, { NX: true, EX: 60 });
  if (locked !== 'OK') return;
  const now = new Date();
  try {
    let rows;
    try {
      rows = await db.select().from(cameraStreamCleanup);
    } catch (error) {
      // A rolling deployment can start the new app before its additive
      // migration has run. Keep the existing app healthy and let the next
      // interval retry once the table exists.
      if (error instanceof Error && /relation [^ ]*camera_stream_cleanup[^ ]* does not exist/.test(error.message)) return;
      throw error;
    }
    for (const row of rows) {
    if (row.state === 'released' || row.state === 'stopping') continue;
    if (row.state !== 'failed' && row.hardDeadline > now) continue;
    const mapping = row.mapping && typeof row.mapping === 'object' ? row.mapping as { haCameraEntityId?: unknown } : {};
    if (typeof mapping.haCameraEntityId !== 'string') {
      await db.update(cameraStreamCleanup).set({ state: 'failed', lastError: 'Cleanup mapping is invalid', updatedAt: now }).where(eq(cameraStreamCleanup.id, row.id));
      continue;
    }
    const entityId = mapping.haCameraEntityId;
    await db.update(cameraStreamCleanup).set({ state: 'stopping', updatedAt: now }).where(and(eq(cameraStreamCleanup.id, row.id), inArray(cameraStreamCleanup.state, ['pending', 'active', 'failed'])));
    try {
      const config = await getHomeAssistantCameraConfig();
      if (!config) throw new CameraSessionError('unavailable', 'Home Assistant camera configuration is missing during cleanup');
      await withCameraStartLock(row.cameraId, () => stopP2PLivestream({ id: row.cameraId, name: row.cameraId, enabled: true, haCameraEntityId: entityId, ringEntityId: null, motionEntityId: null, pictureEntityId: null, go2rtcAlias: null, targetDisplayId: null, eventKinds: ['motion'] }));
      await db.update(cameraStreamCleanup).set({ state: 'released', lastError: null, updatedAt: new Date() }).where(eq(cameraStreamCleanup.id, row.id));
    } catch (error) {
      await db.update(cameraStreamCleanup).set({ state: 'failed', lastError: error instanceof Error ? error.message.slice(0, 500) : 'Cleanup failed', updatedAt: new Date() }).where(eq(cameraStreamCleanup.id, row.id));
    }
    }
  } finally {
    await client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      { keys: ['camera:cleanup-leader'], arguments: [lockValue] },
    ).catch(() => undefined);
  }
}

export async function stopP2PLivestream(mapping: CameraMapping): Promise<void> {
  const config = await getHomeAssistantCameraConfig();
  if (!config) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await homeAssistantCameraFetch(config, '/api/services/camera/stop_p2p_livestream', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({ entity_id: mapping.haCameraEntityId }),
      signal: controller.signal,
    });
    if (!response.ok) throw new CameraSessionError('upstream', 'Home Assistant could not stop the camera stream');
  } catch (error) {
    if (error instanceof CameraSessionError) throw error;
    throw new CameraSessionError('upstream', 'Home Assistant camera stop request failed');
  } finally {
    clearTimeout(timeout);
  }
}

export function sessionErrorStatus(error: unknown): number {
  if (!(error instanceof CameraSessionError)) return 500;
  if (error.code === 'invalid') return 400;
  if (error.code === 'not_found') return 404;
  if (error.code === 'unavailable') return 503;
  return 502;
}
