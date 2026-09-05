import { eq } from 'drizzle-orm';
import { apiCredentials } from '@/lib/db/schema';
import { db } from '@/lib/db/client';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import { validatePublicUrl } from '@/lib/utils/safeFetch';
import { homeAssistantFetch } from './homeAssistantCredentials';

export const HOME_ASSISTANT_CAMERA_SERVICE = 'home-assistant-cameras';
export const MAX_CAMERA_MAPPINGS = 12;
export const MAX_CAMERA_DISCOVERY_CANDIDATES = 200;
export const PRISM_CAMERA_IDS = ['doorbell-1', 'doorbell-2', 'floodlight-1'] as const;

export type CameraEventKind = 'doorbell' | 'motion';

export type CameraMapping = {
  id: string;
  name: string;
  enabled: boolean;
  haCameraEntityId: string;
  ringEntityId: string | null;
  motionEntityId: string | null;
  pictureEntityId: string | null;
  go2rtcAlias: string | null;
  targetDisplayId: string | null;
  eventKinds: CameraEventKind[];
};

export type HomeAssistantCameraConfig = {
  enabled: boolean;
  baseUrl: string;
  accessToken: string;
  go2rtcBaseUrl: string | null;
  go2rtcAccessToken: string | null;
  cameras: CameraMapping[];
};

const CAMERA_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;
const ENTITY_ID_RE = /^[a-z][a-z0-9_]*\.[a-z0-9_]+$/;
const GO2RTC_ALIAS_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const DISPLAY_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/;

function requiredString(value: unknown, message: string, maxLength = 4096): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(message);
  }
  return value.trim();
}

function optionalString(value: unknown, message: string, maxLength = 4096): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredString(value, message, maxLength);
}

function validateEntityId(value: unknown, label: string): string {
  const entityId = requiredString(value, `${label} is required`, 255);
  if (!ENTITY_ID_RE.test(entityId)) throw new Error(`Invalid ${label}`);
  return entityId;
}

function validateOptionalEntityId(value: unknown, label: string): string | null {
  const entityId = optionalString(value, `Invalid ${label}`, 255);
  if (entityId !== null && !ENTITY_ID_RE.test(entityId)) throw new Error(`Invalid ${label}`);
  return entityId;
}

function validateCameraMapping(input: unknown): CameraMapping {
  if (!input || typeof input !== 'object') throw new Error('Camera mapping must be an object');
  const value = input as Record<string, unknown>;
  const id = requiredString(value.id, 'Camera ID is required', 100).toLowerCase();
  if (!CAMERA_ID_RE.test(id)) throw new Error('Camera ID must contain only letters, numbers, and hyphens');
  if (!(PRISM_CAMERA_IDS as readonly string[]).includes(id)) {
    throw new Error(`Camera ID must be one of: ${PRISM_CAMERA_IDS.join(', ')}`);
  }
  const name = requiredString(value.name, 'Camera name is required', 100);

  const rawKinds = value.eventKinds === undefined ? ['motion'] : value.eventKinds;
  if (!Array.isArray(rawKinds) || rawKinds.length === 0 || rawKinds.length > 2) {
    throw new Error('Camera eventKinds must contain one or two event kinds');
  }
  const eventKinds = [...new Set(rawKinds)].map((kind) => {
    if (kind !== 'doorbell' && kind !== 'motion') throw new Error('Unsupported camera event kind');
    return kind;
  });

  const go2rtcAlias = optionalString(value.go2rtcAlias, 'Invalid go2rtc alias', 128);
  if (go2rtcAlias !== null && !GO2RTC_ALIAS_RE.test(go2rtcAlias)) {
    throw new Error('Invalid go2rtc alias');
  }
  const targetDisplayId = optionalString(value.targetDisplayId, 'Invalid target display ID', 100);
  if (targetDisplayId !== null && !DISPLAY_ID_RE.test(targetDisplayId)) {
    throw new Error('Invalid target display ID');
  }

  return {
    id,
    name,
    enabled: value.enabled !== false,
    haCameraEntityId: validateEntityId(value.haCameraEntityId, 'Home Assistant camera entity ID'),
    ringEntityId: validateOptionalEntityId(value.ringEntityId, 'ring entity ID'),
    motionEntityId: validateOptionalEntityId(value.motionEntityId, 'motion entity ID'),
    pictureEntityId: validateOptionalEntityId(value.pictureEntityId, 'picture entity ID'),
    go2rtcAlias,
    targetDisplayId,
    eventKinds,
  };
}

export function normalizeHomeAssistantCameraUrl(value: unknown, label: string): string {
  const raw = requiredString(value, `${label} is required`, 2048).replace(/\/+$/, '');
  const parsed = validatePublicUrl(raw);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${label} must not contain credentials or query parameters`);
  }
  return parsed.toString().replace(/\/+$/, '');
}

export function validateHomeAssistantCameraConfig(input: unknown): HomeAssistantCameraConfig {
  if (!input || typeof input !== 'object') throw new Error('Camera configuration must be an object');
  const value = input as Record<string, unknown>;
  const rawCameras = value.cameras;
  if (!Array.isArray(rawCameras) || rawCameras.length === 0 || rawCameras.length > MAX_CAMERA_MAPPINGS) {
    throw new Error(`Camera configuration must contain between 1 and ${MAX_CAMERA_MAPPINGS} cameras`);
  }

  const cameras = rawCameras.map(validateCameraMapping);
  if (new Set(cameras.map((camera) => camera.id)).size !== cameras.length) {
    throw new Error('Camera IDs must be unique');
  }

  const go2rtcBaseUrl =
    value.go2rtcBaseUrl === undefined || value.go2rtcBaseUrl === null || value.go2rtcBaseUrl === ''
      ? null
      : normalizeHomeAssistantCameraUrl(value.go2rtcBaseUrl, 'go2rtc URL');
  const go2rtcAccessToken = optionalString(value.go2rtcAccessToken, 'Invalid go2rtc access token');

  return {
    enabled: value.enabled === true,
    baseUrl: normalizeHomeAssistantCameraUrl(value.baseUrl, 'Home Assistant URL'),
    accessToken: requiredString(value.accessToken, 'Home Assistant access token is required'),
    go2rtcBaseUrl,
    go2rtcAccessToken,
    cameras,
  };
}

export async function getHomeAssistantCameraConfig(): Promise<HomeAssistantCameraConfig | null> {
  const row = await db.query.apiCredentials.findFirst({
    where: (credentials, { eq: equals }) => equals(credentials.service, HOME_ASSISTANT_CAMERA_SERVICE),
  });
  if (!row) return null;
  return validateHomeAssistantCameraConfig(JSON.parse(decrypt(row.encryptedCredentials)));
}

export async function saveHomeAssistantCameraConfig(config: HomeAssistantCameraConfig): Promise<void> {
  const validated = validateHomeAssistantCameraConfig(config);
  const encryptedCredentials = encrypt(JSON.stringify(validated));
  await db
    .insert(apiCredentials)
    .values({ service: HOME_ASSISTANT_CAMERA_SERVICE, encryptedCredentials })
    .onConflictDoUpdate({
      target: apiCredentials.service,
      set: { encryptedCredentials, updatedAt: new Date() },
    });
}

export async function deleteHomeAssistantCameraConfig(): Promise<void> {
  await db.delete(apiCredentials).where(eq(apiCredentials.service, HOME_ASSISTANT_CAMERA_SERVICE));
}

/** A settings-safe projection. It deliberately omits both HA and go2rtc secrets. */
export function redactHomeAssistantCameraConfig(config: HomeAssistantCameraConfig | null) {
  if (!config) return { configured: false };
  return {
    configured: true,
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    go2rtcBaseUrl: config.go2rtcBaseUrl,
    hasAccessToken: Boolean(config.accessToken),
    hasGo2rtcAccessToken: Boolean(config.go2rtcAccessToken),
    cameras: config.cameras.map(({ id, name, enabled, haCameraEntityId, ringEntityId, motionEntityId, pictureEntityId, go2rtcAlias, targetDisplayId, eventKinds }) => ({
      id,
      name,
      enabled,
      haCameraEntityId,
      ringEntityId,
      motionEntityId,
      pictureEntityId,
      go2rtcAlias,
      targetDisplayId,
      eventKinds,
    })),
  };
}

/**
 * Use the existing HA fetch helper so camera requests retain its auth header,
 * redirect, and SSRF protections without changing media-player semantics.
 */
export function homeAssistantCameraFetch(
  config: Pick<HomeAssistantCameraConfig, 'baseUrl' | 'accessToken'>,
  path: string,
  init: RequestInit = {},
) {
  return homeAssistantFetch(config, path, init);
}

export function cameraDiscoveryCandidates(states: unknown) {
  if (!Array.isArray(states)) return [];
  return states
    .filter((state): state is Record<string, unknown> => {
      if (!state || typeof state !== 'object') return false;
      const entityId = (state as Record<string, unknown>).entity_id;
      return typeof entityId === 'string' && /^(camera|binary_sensor|event|sensor)\.[a-z0-9_]+$/.test(entityId);
    })
    .slice(0, MAX_CAMERA_DISCOVERY_CANDIDATES)
    .map((state) => {
      const entityId = state.entity_id as string;
      const attributes = state.attributes && typeof state.attributes === 'object'
        ? state.attributes as Record<string, unknown>
        : {};
      const friendlyName = typeof attributes.friendly_name === 'string' ? attributes.friendly_name : null;
      const deviceClass = typeof attributes.device_class === 'string' ? attributes.device_class : null;
      const descriptor = `${entityId} ${friendlyName ?? ''} ${deviceClass ?? ''}`;
      return {
        entity_id: entityId,
        domain: entityId.split('.')[0],
        friendly_name: friendlyName,
        state: typeof state.state === 'string' ? state.state : null,
        device_class: deviceClass,
        likelyCamera: entityId.startsWith('camera.'),
        likelyRing: /ring|doorbell|pressed/i.test(descriptor),
        likelyMotion: /motion|occupancy|person/i.test(descriptor),
      };
    });
}
