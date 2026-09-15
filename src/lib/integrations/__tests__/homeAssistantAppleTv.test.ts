import {
  HOME_ASSISTANT_MEDIA_PLAYER_FEATURES as F,
  buildHomeAssistantAppleTvActionRequests,
  estimateHomeAssistantAppleTvPosition,
  normalizeHomeAssistantAppleTvState,
} from '../homeAssistantAppleTv';

describe('Home Assistant Apple TV integration', () => {
  it('normalizes missing fields safely', () => {
    expect(normalizeHomeAssistantAppleTvState(null)).toEqual(
      expect.objectContaining({
        entityId: null,
        deviceName: null,
        title: null,
        position: null,
        supportedFeatures: 0,
        supportedControls: [],
      })
    );
  });

  it('normalizes video and music metadata and feature flags', () => {
    const state = normalizeHomeAssistantAppleTvState({
      entity_id: 'media_player.tv',
      state: 'playing',
      attributes: {
        friendly_name: 'Living Room',
        media_title: 'Episode',
        media_artist: 'Director',
        media_album_name: 'Season 1',
        media_content_type: 'video',
        app_name: 'TV',
        media_position: 12,
        media_duration: 100,
        supported_features: F.PLAY | F.PAUSE | F.SEEK | F.NEXT_TRACK,
      },
    });
    expect(state.title).toBe('Episode');
    expect(state.deviceName).toBe('Living Room');
    expect(state.mediaType).toBe('video');
    expect(state.supportedControls).toEqual(
      expect.arrayContaining(['play', 'pause', 'play_pause', 'seek', 'next'])
    );
    expect(
      normalizeHomeAssistantAppleTvState({
        attributes: {
          media_artist: 'Artist',
          media_album_name: 'Album',
          media_content_type: 'music',
          supported_features: F.VOLUME_SET,
        },
      }).artist
    ).toBe('Artist');
  });

  it('extrapolates position and end time', () => {
    const now = new Date('2026-01-01T00:00:10Z');
    const result = estimateHomeAssistantAppleTvPosition(
      { position: 20, duration: 100, positionUpdatedAt: '2026-01-01T00:00:00Z', state: 'playing' },
      now
    );
    expect(result.position).toBe(30);
    expect(result.endTime).toEqual(new Date('2026-01-01T00:01:20Z'));
    expect(
      estimateHomeAssistantAppleTvPosition(
        { position: null, duration: 1, positionUpdatedAt: null, state: 'playing' },
        now
      )
    ).toEqual({ position: null, endTime: null });
  });

  it.each(['paused', 'buffering', 'idle', null])('does not extrapolate %s state', (state) => {
    expect(
      estimateHomeAssistantAppleTvPosition(
        { position: 20, duration: 100, positionUpdatedAt: '2026-01-01T00:00:00Z', state },
        new Date('2026-01-01T00:00:10Z')
      )
    ).toEqual({ position: 20, endTime: new Date('2026-01-01T00:01:30Z') });
  });

  it('handles stale, future, missing, and invalid timestamps', () => {
    const base = { position: 20, duration: 100, state: 'playing' } as const;
    const now = new Date('2026-01-01T00:00:10Z');
    expect(
      estimateHomeAssistantAppleTvPosition(
        { ...base, positionUpdatedAt: '2026-01-01T00:00:00Z' },
        now
      ).position
    ).toBe(30);
    expect(
      estimateHomeAssistantAppleTvPosition(
        { ...base, positionUpdatedAt: '2026-01-01T00:00:20Z' },
        now
      ).position
    ).toBe(20);
    expect(
      estimateHomeAssistantAppleTvPosition({ ...base, positionUpdatedAt: null }, now).position
    ).toBe(20);
    expect(
      estimateHomeAssistantAppleTvPosition({ ...base, positionUpdatedAt: 'nope' }, now).position
    ).toBe(20);
  });

  it('builds exact seek, stop, and volume payloads', () => {
    const seek = buildHomeAssistantAppleTvActionRequests(
      { control: 'seek', seekPosition: 42 },
      'media_player.tv'
    )[0];
    const zeroSeek = buildHomeAssistantAppleTvActionRequests(
      { control: 'seek', seekPosition: 0 },
      'media_player.tv'
    )[0];
    const volume = buildHomeAssistantAppleTvActionRequests(
      { control: 'volume_set', volumeLevel: 0.5 },
      'media_player.tv'
    )[0];
    const mute = buildHomeAssistantAppleTvActionRequests(
      { control: 'volume_mute', isVolumeMuted: true },
      'media_player.tv'
    )[0];
    const stop = buildHomeAssistantAppleTvActionRequests({ control: 'stop' }, 'media_player.tv')[0];
    expect(seek).toEqual({
      domain: 'media_player',
      service: 'media_seek',
      data: { entity_id: 'media_player.tv', seek_position: 42 },
    });
    expect(zeroSeek?.data.seek_position).toBe(0);
    expect(volume).toBeDefined();
    expect(volume?.data.volume_level).toBe(0.5);
    expect(mute).toBeDefined();
    expect(mute?.data.is_volume_muted).toBe(true);
    expect(stop).toEqual({
      domain: 'media_player',
      service: 'media_stop',
      data: { entity_id: 'media_player.tv' },
    });
  });

  it('builds power commands in order', () => {
    expect(
      buildHomeAssistantAppleTvActionRequests(
        { control: 'turn_off', remoteEntityId: 'remote.tv' },
        'media_player.tv'
      )
    ).toEqual([
      {
        domain: 'remote',
        service: 'send_command',
        requestId: 'suspend',
        data: { entity_id: 'remote.tv', command: ['suspend'] },
      },
      {
        domain: 'media_player',
        service: 'turn_off',
        requestId: 'turn_off',
        data: { entity_id: 'media_player.tv' },
      },
    ]);
  });

  it('requires a valid remote entity for the two-step sleep request', () => {
    expect(() =>
      buildHomeAssistantAppleTvActionRequests({ control: 'turn_off' }, 'media_player.tv')
    ).toThrow('Invalid Home Assistant entity ID');
    expect(() =>
      buildHomeAssistantAppleTvActionRequests(
        { control: 'turn_off', remoteEntityId: 'media_player.tv' },
        'media_player.tv'
      )
    ).toThrow('Invalid Home Assistant entity ID');
  });

  it('validates and clamps state inputs', () => {
    const s = normalizeHomeAssistantAppleTvState({
      entity_id: 'bad',
      state: 'playing',
      attributes: {
        media_position: 20,
        media_duration: 10,
        volume_level: 2,
        supported_features: 1.5,
        media_title: '  title  ',
      },
    });
    expect(s.entityId).toBeNull();
    expect(s.position).toBe(10);
    expect(s.volumeLevel).toBeNull();
    expect(s.supportedFeatures).toBe(0);
    expect(s.title).toBe('title');
  });

  it.each([
    [{ control: 'seek', seekPosition: -1 }, 'media_player.tv'],
    [{ control: 'seek', seekPosition: Infinity }, 'media_player.tv'],
    [{ control: 'volume_set', volumeLevel: 2 }, 'media_player.tv'],
    [{ control: 'volume_mute', isVolumeMuted: 'yes' }, 'media_player.tv'],
    [{ control: 'play' }, 'remote.tv'],
    [{ control: 'play' }, 'not-an-entity'],
  ])('rejects invalid action input', (input, id) => {
    expect(() => buildHomeAssistantAppleTvActionRequests(input as never, id)).toThrow();
  });

  it('gates play_pause on both capabilities', () => {
    expect(
      normalizeHomeAssistantAppleTvState({ attributes: { supported_features: F.PLAY } })
        .supportedControls
    ).not.toContain('play_pause');
    expect(
      normalizeHomeAssistantAppleTvState({ attributes: { supported_features: F.PLAY | F.PAUSE } })
        .supportedControls
    ).toContain('play_pause');
  });
});
