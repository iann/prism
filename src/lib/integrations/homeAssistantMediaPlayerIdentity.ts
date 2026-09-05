import { createHash } from 'node:crypto';
import type { HomeAssistantMediaPlayerState } from './homeAssistantMediaPlayer';

/**
 * Creates an opaque client-safe identity for the currently selected media.
 * Home Assistant content IDs can contain provider tokens, so only the digest
 * crosses the API boundary.
 */
export function buildHomeAssistantMediaIdentity(
  state: Pick<
    HomeAssistantMediaPlayerState,
    | 'entityId'
    | 'mediaContentId'
    | 'title'
    | 'series'
    | 'episode'
    | 'artist'
    | 'album'
    | 'mediaType'
    | 'appName'
    | 'duration'
  >
): string | null {
  if (!state.entityId) return null;

  const source = state.mediaContentId
    ? { entityId: state.entityId, mediaContentId: state.mediaContentId }
    : {
        entityId: state.entityId,
        title: state.title,
        series: state.series,
        episode: state.episode,
        artist: state.artist,
        album: state.album,
        mediaType: state.mediaType,
        appName: state.appName,
        duration: state.duration,
      };

  const hasFallbackMetadata =
    !!state.mediaContentId ||
    Boolean(
      state.title ||
        state.series ||
        state.episode ||
        state.artist ||
        state.album ||
        state.appName
    );
  if (!hasFallbackMetadata) return null;

  return createHash('sha256').update(JSON.stringify(source)).digest('hex').slice(0, 32);
}
