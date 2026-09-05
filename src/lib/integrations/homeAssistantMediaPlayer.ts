export const HOME_ASSISTANT_MEDIA_PLAYER_FEATURES = {
  PAUSE: 1,
  SEEK: 2,
  VOLUME_SET: 4,
  VOLUME_MUTE: 8,
  PREVIOUS_TRACK: 16,
  NEXT_TRACK: 32,
  STOP: 4096,
  TURN_OFF: 256,
  PLAY: 16384,
} as const;

export type SupportedMediaPlayerControl =
  | 'play'
  | 'pause'
  | 'play_pause'
  | 'previous'
  | 'next'
  | 'stop'
  | 'seek'
  | 'volume_set'
  | 'volume_mute'
  | 'turn_off';

export type HomeAssistantMediaPlayerActionInput =
  | { control: 'play' | 'pause' | 'play_pause' | 'previous' | 'next' }
  | { control: 'stop' }
  | { control: 'turn_off'; remoteEntityId?: string | null }
  | { control: 'seek'; seekPosition: number }
  | { control: 'volume_set'; volumeLevel: number }
  | { control: 'volume_mute'; isVolumeMuted: boolean };

export type HomeAssistantMediaPlayerState = {
  entityId: string | null;
  deviceName: string | null;
  state: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  mediaType: string | null;
  appName: string | null;
  series: string | null;
  episode: string | null;
  /** Server-only source value; API routes must remove it before serialization. */
  mediaContentId: string | null;
  thumbnail: string | null;
  position: number | null;
  duration: number | null;
  positionUpdatedAt: string | null;
  volumeLevel: number | null;
  isVolumeMuted: boolean | null;
  supportedFeatures: number;
  supportedControls: SupportedMediaPlayerControl[];
};

type RawState = { entity_id?: unknown; state?: unknown; attributes?: unknown } | null | undefined;
const text = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
const nonnegative = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const entityId = (value: unknown): string | null =>
  typeof value === 'string' && /^[a-z0-9_-]+\.[a-z0-9_-]+$/.test(value.trim())
    ? value.trim()
    : null;
const featureMask = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 0x7fffffff
    ? value
    : 0;

export function normalizeHomeAssistantMediaPlayerState(
  raw: RawState
): HomeAssistantMediaPlayerState {
  const a: Record<string, unknown> =
    raw?.attributes !== null && typeof raw?.attributes === 'object'
      ? (raw.attributes as Record<string, unknown>)
      : {};
  const supportedFeatures = featureMask(a.supported_features);
  const has = (bit: number) => (supportedFeatures & bit) === bit;
  const supportedControls: SupportedMediaPlayerControl[] = [];
  if (has(HOME_ASSISTANT_MEDIA_PLAYER_FEATURES.PLAY)) supportedControls.push('play');
  if (has(HOME_ASSISTANT_MEDIA_PLAYER_FEATURES.PAUSE)) supportedControls.push('pause');
  if (has(HOME_ASSISTANT_MEDIA_PLAYER_FEATURES.PREVIOUS_TRACK)) supportedControls.push('previous');
  if (has(HOME_ASSISTANT_MEDIA_PLAYER_FEATURES.NEXT_TRACK)) supportedControls.push('next');
  if (has(HOME_ASSISTANT_MEDIA_PLAYER_FEATURES.STOP)) supportedControls.push('stop');
  if (has(HOME_ASSISTANT_MEDIA_PLAYER_FEATURES.SEEK)) supportedControls.push('seek');
  if (has(HOME_ASSISTANT_MEDIA_PLAYER_FEATURES.VOLUME_SET)) supportedControls.push('volume_set');
  if (has(HOME_ASSISTANT_MEDIA_PLAYER_FEATURES.VOLUME_MUTE)) supportedControls.push('volume_mute');
  if (has(HOME_ASSISTANT_MEDIA_PLAYER_FEATURES.TURN_OFF)) supportedControls.push('turn_off');
  if (
    has(HOME_ASSISTANT_MEDIA_PLAYER_FEATURES.PLAY) &&
    has(HOME_ASSISTANT_MEDIA_PLAYER_FEATURES.PAUSE)
  )
    supportedControls.push('play_pause');
  const duration = nonnegative(a.media_duration);
  const rawPosition = nonnegative(a.media_position);
  return {
    entityId: entityId(raw?.entity_id),
    deviceName: text(a.friendly_name),
    state: text(raw?.state),
    title: text(a.media_title),
    series: text(a.media_series_title) ?? text(a.media_series),
    episode: text(a.media_episode) ?? text(a.media_episode_title),
    artist: text(a.media_artist),
    album: text(a.media_album_name),
    mediaType: text(a.media_content_type),
    appName: text(a.app_name),
    mediaContentId: text(a.media_content_id),
    thumbnail: text(a.entity_picture),
    position:
      rawPosition == null || duration == null ? rawPosition : Math.min(rawPosition, duration),
    duration,
    positionUpdatedAt: text(a.media_position_updated_at),
    volumeLevel:
      typeof a.volume_level === 'number' &&
      Number.isFinite(a.volume_level) &&
      a.volume_level >= 0 &&
      a.volume_level <= 1
        ? a.volume_level
        : null,
    isVolumeMuted: typeof a.is_volume_muted === 'boolean' ? a.is_volume_muted : null,
    supportedFeatures,
    supportedControls,
  };
}

type MediaService =
  | 'media_play'
  | 'media_pause'
  | 'media_play_pause'
  | 'media_previous_track'
  | 'media_next_track'
  | 'media_stop'
  | 'media_seek'
  | 'volume_set'
  | 'volume_mute'
  | 'turn_off';
export type HomeAssistantServiceRequest = {
  domain: 'media_player' | 'remote';
  service: MediaService | 'send_command';
  data: Record<string, unknown>;
  requestId?: 'suspend' | 'turn_off';
};
const validEntity = (value: unknown, domain?: 'media_player' | 'remote'): string => {
  const id = entityId(value);
  if (!id || (domain && !id.startsWith(`${domain}.`)))
    throw new Error('Invalid Home Assistant entity ID');
  return id;
};
const media = (
  service: MediaService,
  id: string,
  data: Record<string, unknown> = {},
  requestId?: 'turn_off'
): HomeAssistantServiceRequest => ({
  domain: 'media_player',
  service,
  data: { entity_id: id, ...data },
  ...(requestId ? { requestId } : {}),
});

export function buildHomeAssistantMediaPlayerActionRequests(
  input: HomeAssistantMediaPlayerActionInput,
  mediaPlayerEntityId: string
): HomeAssistantServiceRequest[] {
  const id = validEntity(mediaPlayerEntityId, 'media_player');
  if (typeof input !== 'object' || input === null) throw new Error('Invalid media-player action');
  if (
    input.control === 'seek' &&
    (!Number.isFinite(input.seekPosition) ||
      input.seekPosition < 0 ||
      input.seekPosition > Number.MAX_SAFE_INTEGER)
  )
    throw new Error('Invalid seek position');
  if (
    input.control === 'volume_set' &&
    (!Number.isFinite(input.volumeLevel) || input.volumeLevel < 0 || input.volumeLevel > 1)
  )
    throw new Error('Invalid volume level');
  if (input.control === 'volume_mute' && typeof input.isVolumeMuted !== 'boolean')
    throw new Error('Invalid mute state');
  switch (input.control) {
    case 'play':
      return [media('media_play', id)];
    case 'pause':
      return [media('media_pause', id)];
    case 'play_pause':
      return [media('media_play_pause', id)];
    case 'previous':
      return [media('media_previous_track', id)];
    case 'next':
      return [media('media_next_track', id)];
    case 'stop':
      return [media('media_stop', id)];
    case 'seek':
      return [media('media_seek', id, { seek_position: input.seekPosition })];
    case 'volume_set':
      return [media('volume_set', id, { volume_level: input.volumeLevel })];
    case 'volume_mute':
      return [media('volume_mute', id, { is_volume_muted: input.isVolumeMuted })];
    // Apple TV-like remotes can be suspended before the generic player is turned off.
    case 'turn_off': {
      const requests: HomeAssistantServiceRequest[] = [];
      if (input.remoteEntityId) {
        const remoteId = validEntity(input.remoteEntityId, 'remote');
        requests.push({
          domain: 'remote',
          service: 'send_command',
          requestId: 'suspend',
          data: { entity_id: remoteId, command: ['suspend'] },
        });
      }
      requests.push(media('turn_off', id, {}, 'turn_off'));
      return requests;
    }
  }
  throw new Error('Invalid media-player action control');
}

/** End time is estimated from `now` and the resulting position, and is null without a valid duration. */
export function estimateHomeAssistantMediaPlayerPosition(
  state: Pick<HomeAssistantMediaPlayerState, 'position' | 'positionUpdatedAt' | 'duration' | 'state'>,
  now: Date | number = Date.now()
): { position: number | null; endTime: Date | null } {
  if (state.position == null) return { position: null, endTime: null };
  const nowMs = now instanceof Date ? now.getTime() : now;
  const updatedMs = state.positionUpdatedAt ? Date.parse(state.positionUpdatedAt) : NaN;
  const elapsed =
    state.state === 'playing' && Number.isFinite(updatedMs)
      ? Math.max(0, (nowMs - updatedMs) / 1000)
      : 0;
  const position =
    state.duration == null
      ? state.position + elapsed
      : Math.min(state.duration, state.position + elapsed);
  return {
    position,
    endTime:
      state.duration == null
        ? null
        : new Date(nowMs + Math.max(0, state.duration - position) * 1000),
  };
}
