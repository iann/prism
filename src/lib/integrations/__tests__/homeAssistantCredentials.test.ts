import {
  discoveryCandidates,
  MAX_DISCOVERY_CANDIDATES,
  normalizeBaseUrl,
  validateEntity,
} from '../homeAssistantCredentials';

describe('Home Assistant configuration safety', () => {
  it('normalizes URLs and enforces entity domains', () => {
    expect(normalizeBaseUrl('https://ha.example.test///')).toBe('https://ha.example.test');
    expect(validateEntity('media_player.living_room', 'media_player')).toBe(
      'media_player.living_room'
    );
    expect(() => validateEntity('remote.living_room', 'media_player')).toThrow();
  });

  it('returns only safe discovery candidates and never attributes', () => {
    expect(
      discoveryCandidates([
        {
          entity_id: 'media_player.apple_tv',
          state: 'playing',
          attributes: {
            friendly_name: 'Apple TV',
            app_name: 'TV',
            entity_picture: '/secret',
            media_content_type: 'video',
            access_token: 'secret',
          },
        },
        { entity_id: 'light.kitchen', state: 'on', attributes: { friendly_name: 'Kitchen' } },
        {
          entity_id: 'remote.apple_tv',
          state: 'idle',
          attributes: { friendly_name: 'Apple TV Remote' },
        },
      ])
    ).toEqual([
      {
        entity_id: 'media_player.apple_tv',
        friendly_name: 'Apple TV',
        state: 'playing',
        app_name: 'TV',
        media_content_type: 'video',
        likelyAppleTv: true,
      },
      {
        entity_id: 'remote.apple_tv',
        friendly_name: 'Apple TV Remote',
        state: 'idle',
        app_name: null,
        media_content_type: null,
        likelyAppleTv: false,
      },
    ]);
  });

  it('caps discovery candidates at the safe response limit', () => {
    expect(
      discoveryCandidates(
        Array.from({ length: MAX_DISCOVERY_CANDIDATES + 1 }, (_, i) => ({
          entity_id: `remote.tv_${i}`,
        }))
      )
    ).toHaveLength(MAX_DISCOVERY_CANDIDATES);
  });
});
