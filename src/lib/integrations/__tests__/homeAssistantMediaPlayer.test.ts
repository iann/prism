import {
  buildHomeAssistantMediaPlayerActionRequests,
  identifyMediaPlayerService,
  normalizeHomeAssistantMediaPlayerState,
} from '../homeAssistantMediaPlayer';
import { buildHomeAssistantMediaIdentity } from '../homeAssistantMediaPlayerIdentity';

const mediaPlayer = 'media_player.living_room';

function makeState(attributes: Record<string, unknown> = {}) {
  return normalizeHomeAssistantMediaPlayerState({
    entity_id: mediaPlayer,
    state: 'playing',
    attributes: {
      media_title: 'Film',
      media_duration: 120,
      ...attributes,
    },
  });
}

describe('Home Assistant media-player integration', () => {
  it.each([
    ['YouTube', 'youtube'],
    ['YouTube Music', 'youtube-music'],
    ['Netflix', 'netflix'],
    ['Disney+', 'disney-plus'],
    ['Prime Video', 'prime-video'],
    ['HBO Max', 'max'],
    ['Paramount+', 'paramount-plus'],
    ['Plex', 'plex'],
    ['Apple TV', 'apple-tv'],
    ['Apple TV+', 'apple-tv'],
    ['tv.apple.com', 'apple-tv'],
    ['YourLocalTV', 'local-tv-plus'],
    ['Mass Local TV', 'local-tv-plus'],
    ['LocalTV+', 'local-tv-plus'],
    ['Spotify', 'spotify'],
    ['Twitch', 'twitch'],
  ] as const)('recognizes %s as %s', (hint, service) => {
    expect(identifyMediaPlayerService(hint)).toBe(service);
  });

  it('uses a source or content ID when the app name is not useful', () => {
    expect(
      normalizeHomeAssistantMediaPlayerState({
        entity_id: mediaPlayer,
        attributes: {
          app_name: 'Chromecast',
          source: 'YouTube',
          media_content_id: 'https://www.youtube.com/watch?v=abc',
        },
      }).mediaService
    ).toBe('youtube');
  });

  it('turns off a generic media player without requiring a remote', () => {
    expect(
      buildHomeAssistantMediaPlayerActionRequests({ control: 'turn_off' }, mediaPlayer)
    ).toEqual([
      {
        domain: 'media_player',
        service: 'turn_off',
        requestId: 'turn_off',
        data: { entity_id: mediaPlayer },
      },
    ]);
  });

  it('adds the optional Apple TV-style suspend before power off', () => {
    expect(
      buildHomeAssistantMediaPlayerActionRequests(
        { control: 'turn_off', remoteEntityId: 'remote.living_room' },
        mediaPlayer
      )
    ).toEqual([
      {
        domain: 'remote',
        service: 'send_command',
        requestId: 'suspend',
        data: { entity_id: 'remote.living_room', command: ['suspend'] },
      },
      {
        domain: 'media_player',
        service: 'turn_off',
        requestId: 'turn_off',
        data: { entity_id: mediaPlayer },
      },
    ]);
  });

  it('prefers media_content_id and never returns it in the identity', () => {
    const rawId = 'provider://film?token=must-not-leak';
    const identity = buildHomeAssistantMediaIdentity(makeState({ media_content_id: rawId }));
    expect(identity).toMatch(/^[a-f0-9]{32}$/);
    expect(identity).not.toContain(rawId);
  });

  it('uses a stable metadata fallback when media_content_id is absent', () => {
    const first = buildHomeAssistantMediaIdentity(makeState({ media_artist: 'Director' }));
    const second = buildHomeAssistantMediaIdentity(makeState({ media_artist: 'Director' }));
    const changed = buildHomeAssistantMediaIdentity(makeState({ media_title: 'Another film' }));
    expect(first).toMatch(/^[a-f0-9]{32}$/);
    expect(second).toBe(first);
    expect(changed).not.toBe(first);
  });
});
