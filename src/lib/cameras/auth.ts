import { createHash, randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { cameraAccessGrants } from '@/lib/db/schema';
import { getHomeAssistantCameraConfig } from '@/lib/integrations/homeAssistantCameraCredentials';

export const CAMERA_DISPLAY_COOKIE = 'prism_camera_display';
export const CAMERA_DISPLAY_GRANT_DAYS = 90;
export const CAMERA_INGRESS_GRANT_DAYS = 365;

export type CameraGrantKind = 'event-ingress' | 'display';

export type CameraGrantAuth = {
  id: string;
  kind: CameraGrantKind;
  cameraIds: string[];
  displayId: string | null;
  expiresAt: Date;
};

export function generateCameraGrantToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashCameraGrantToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function addDays(days: number): Date {
  const result = new Date();
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function normalizeCameraIds(cameraIds: string[]): string[] {
  const normalized = [...new Set(cameraIds.map((id) => id.trim().toLowerCase()))];
  if (normalized.length === 0 || normalized.some((id) => !/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(id))) {
    throw new Error('At least one valid camera ID is required');
  }
  return normalized;
}

export async function createCameraGrant(input: {
  kind: CameraGrantKind;
  cameraIds: string[];
  displayId?: string | null;
  createdBy?: string | null;
  expiresAt?: Date;
}) {
  const cameraIds = normalizeCameraIds(input.cameraIds);
  if (input.kind === 'display' && (!input.displayId || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/.test(input.displayId))) {
    throw new Error('A valid display ID is required for display grants');
  }
  if (input.kind === 'event-ingress' && input.displayId) {
    throw new Error('Event ingress grants cannot be bound to a display');
  }

  const rawToken = generateCameraGrantToken();
  const expiresAt = input.expiresAt ?? addDays(
    input.kind === 'display' ? CAMERA_DISPLAY_GRANT_DAYS : CAMERA_INGRESS_GRANT_DAYS,
  );
  if (expiresAt.getTime() <= Date.now()) throw new Error('Grant expiry must be in the future');

  const [record] = await db.insert(cameraAccessGrants).values({
    kind: input.kind,
    tokenHash: hashCameraGrantToken(rawToken),
    cameraIds,
    displayId: input.displayId ?? null,
    createdBy: input.createdBy ?? null,
    expiresAt,
  }).returning();

  return { rawToken, grant: record! };
}

export async function validateCameraGrant(
  rawToken: string,
  options: { kind: CameraGrantKind; cameraId?: string; displayId?: string } = { kind: 'display' },
): Promise<CameraGrantAuth | null> {
  if (typeof rawToken !== 'string' || !/^[a-f0-9]{64}$/.test(rawToken)) return null;
  const [record] = await db.select().from(cameraAccessGrants).where(
    and(eq(cameraAccessGrants.tokenHash, hashCameraGrantToken(rawToken)), eq(cameraAccessGrants.kind, options.kind)),
  ).limit(1);
  if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now()) return null;
  if (options.cameraId && !record.cameraIds.includes(options.cameraId)) return null;
  if (options.displayId && record.displayId !== options.displayId) return null;

  db.update(cameraAccessGrants)
    .set({ lastUsedAt: new Date() })
    .where(eq(cameraAccessGrants.id, record.id))
    .then(() => {})
    .catch(() => {});

  return {
    id: record.id,
    kind: record.kind,
    cameraIds: record.cameraIds,
    displayId: record.displayId,
    expiresAt: record.expiresAt,
  };
}

export async function validateCameraIngressRequest(cameraId?: string): Promise<CameraGrantAuth | null> {
  const headerStore = await headers();
  const authorization = headerStore.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const grant = await validateCameraGrant(authorization.slice(7), {
    kind: 'event-ingress',
    cameraId,
  });
  if (!grant) return null;
  try {
    const config = await getHomeAssistantCameraConfig();
    if (!config?.enabled || (cameraId && !config.cameras.some((camera) => camera.enabled && camera.id === cameraId))) return null;
  } catch {
    return null;
  }
  return grant;
}

export async function getCameraDisplayGrant(cameraId?: string): Promise<CameraGrantAuth | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(CAMERA_DISPLAY_COOKIE)?.value;
  if (!rawToken) return null;
  const grant = await validateCameraGrant(rawToken, { kind: 'display', cameraId });
  if (!grant) return null;
  try {
    const config = await getHomeAssistantCameraConfig();
    if (!config?.enabled || (cameraId && !config.cameras.some((camera) => camera.enabled && camera.id === cameraId))) return null;
  } catch {
    return null;
  }
  return grant;
}

export async function listCameraGrants(kind?: CameraGrantKind) {
  const rows = kind
    ? await db.select().from(cameraAccessGrants).where(eq(cameraAccessGrants.kind, kind))
    : await db.select().from(cameraAccessGrants);
  return rows.map(({ tokenHash: _tokenHash, ...grant }) => grant);
}

export async function revokeCameraGrant(id: string): Promise<boolean> {
  const result = await db.update(cameraAccessGrants)
    .set({ revokedAt: new Date() })
    .where(and(eq(cameraAccessGrants.id, id), isNull(cameraAccessGrants.revokedAt)))
    .returning({ id: cameraAccessGrants.id });
  return result.length > 0;
}

export function setCameraDisplayCookie(response: Response, rawToken: string, expiresAt: Date): Response {
  // Response has no cookie helper in the standard type; NextResponse augments it.
  const nextResponse = response as Response & { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } };
  nextResponse.cookies.set(CAMERA_DISPLAY_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
  return response;
}

export function clearCameraDisplayCookie(response: Response): Response {
  const nextResponse = response as Response & { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } };
  nextResponse.cookies.set(CAMERA_DISPLAY_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
