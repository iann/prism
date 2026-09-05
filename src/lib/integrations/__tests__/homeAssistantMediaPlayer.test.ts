import {
  buildHomeAssistantMediaPlayerActionRequests,
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
    const identity = buildHomeAssistantMediaIdentity(
      makeState({ media_content_id: rawId })
    );
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
