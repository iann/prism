import { eq } from 'drizzle-orm';
import { apiCredentials } from '@/lib/db/schema';
import { db } from '@/lib/db/client';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import { safeFetch, validatePublicUrl } from '@/lib/utils/safeFetch';

export const HOME_ASSISTANT_SERVICE = 'home-assistant-media-player';
/** Legacy storage key retained so existing Apple TV configurations keep working. */
export const LEGACY_HOME_ASSISTANT_SERVICE = 'home-assistant-apple-tv';
/** Maximum number of entity candidates returned by the setup discovery endpoint. */
export const MAX_DISCOVERY_CANDIDATES = 100;
export type HomeAssistantConfig = {
  baseUrl: string;
  accessToken: string;
  mediaPlayerEntityId: string;
  remoteEntityId: string | null;
};

export function normalizeBaseUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Home Assistant URL is required');
  const parsed = validatePublicUrl(value.trim().replace(/\/+$/, ''));
  return parsed.toString().replace(/\/+$/, '');
}
export function validateEntity(value: unknown, domain: 'media_player' | 'remote'): string {
  if (typeof value !== 'string' || !new RegExp(`^${domain}\\.[a-z0-9_-]+$`).test(value.trim()))
    throw new Error(`Invalid ${domain} entity ID`);
  return value.trim();
}
export function validateConfig(input: unknown): HomeAssistantConfig {
  const v = input as Record<string, unknown>;
  if (typeof v?.accessToken !== 'string' || !v.accessToken.trim())
    throw new Error('Home Assistant access token is required');
  return {
    baseUrl: normalizeBaseUrl(v.baseUrl),
    accessToken: v.accessToken.trim(),
    mediaPlayerEntityId: validateEntity(v.mediaPlayerEntityId, 'media_player'),
    remoteEntityId:
      typeof v.remoteEntityId === 'string' && v.remoteEntityId.trim()
        ? validateEntity(v.remoteEntityId, 'remote')
        : null,
  };
}
export async function getHomeAssistantConfig(): Promise<HomeAssistantConfig | null> {
  const row = (await db.query.apiCredentials.findFirst({
    where: (c, { eq }) => eq(c.service, HOME_ASSISTANT_SERVICE),
  })) ?? (await db.query.apiCredentials.findFirst({
    where: (c, { eq }) => eq(c.service, LEGACY_HOME_ASSISTANT_SERVICE),
  }));
  if (!row) return null;
  const parsed = JSON.parse(decrypt(row.encryptedCredentials)) as Partial<HomeAssistantConfig>;
  return {
    ...parsed,
    baseUrl: parsed.baseUrl as string,
    accessToken: parsed.accessToken as string,
    mediaPlayerEntityId: parsed.mediaPlayerEntityId as string,
    remoteEntityId: parsed.remoteEntityId ?? null,
  };
}
export async function saveHomeAssistantConfig(config: HomeAssistantConfig) {
  const encryptedCredentials = encrypt(JSON.stringify(config));
  await db
    .insert(apiCredentials)
    .values({ service: HOME_ASSISTANT_SERVICE, encryptedCredentials })
    .onConflictDoUpdate({
      target: apiCredentials.service,
      set: { encryptedCredentials, updatedAt: new Date() },
    });
}
export async function deleteHomeAssistantConfig() {
  await db.delete(apiCredentials).where(eq(apiCredentials.service, HOME_ASSISTANT_SERVICE));
  await db.delete(apiCredentials).where(eq(apiCredentials.service, LEGACY_HOME_ASSISTANT_SERVICE));
}
export async function homeAssistantFetch(
  config: Pick<HomeAssistantConfig, 'baseUrl' | 'accessToken'>,
  path: string,
  init: RequestInit = {}
) {
  return safeFetch(`${normalizeBaseUrl(config.baseUrl)}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.accessToken}`,
      ...init.headers,
    },
  });
}
export function discoveryCandidates(states: unknown) {
  if (!Array.isArray(states)) return [];
  return states
    .filter(
      (s): s is Record<string, unknown> =>
        !!s &&
        typeof s === 'object' &&
        !!(s as Record<string, unknown>).entity_id &&
        /^(media_player|remote)\.[a-z0-9_-]+$/.test(
          String((s as Record<string, unknown>).entity_id)
        )
    )
    .slice(0, MAX_DISCOVERY_CANDIDATES)
    .map((s) => {
      const a =
        s.attributes && typeof s.attributes === 'object'
          ? (s.attributes as Record<string, unknown>)
          : {};
      const domain = String(s.entity_id).split('.')[0];
      const appName = typeof a.app_name === 'string' ? a.app_name : null;
      const friendlyName = typeof a.friendly_name === 'string' ? a.friendly_name : null;
      return {
        entity_id: s.entity_id,
        friendly_name: friendlyName,
        state: typeof s.state === 'string' ? s.state : null,
        app_name: appName,
        media_content_type: typeof a.media_content_type === 'string' ? a.media_content_type : null,
        likelyAppleTv:
          domain === 'media_player' &&
          /apple|tvOS|airplay/i.test(`${friendlyName ?? ''} ${appName ?? ''}`),
      };
    });
}
