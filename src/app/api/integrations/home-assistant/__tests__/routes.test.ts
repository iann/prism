import { NextRequest, NextResponse } from 'next/server';

const auth = jest.fn();
const displayAuth = jest.fn();
const role = jest.fn();
const getConfig = jest.fn();
const saveConfig = jest.fn();
const deleteConfig = jest.fn();
const haFetch = jest.fn();
const validate = jest.fn((value: unknown) => value);
const validateEntity = jest.fn((value: unknown) => value);
const candidates = jest.fn((states: unknown[]) =>
  states.map((state) => ({ entity_id: (state as { entity_id: string }).entity_id }))
);

jest.mock('@/lib/auth', () => ({
  requireAuth: auth,
  getDisplayAuth: displayAuth,
  requireRole: role,
}));
jest.mock('@/lib/integrations/homeAssistantCredentials', () => ({
  getHomeAssistantConfig: getConfig,
  saveHomeAssistantConfig: saveConfig,
  deleteHomeAssistantConfig: deleteConfig,
  homeAssistantFetch: haFetch,
  validateConfig: validate,
  validateEntity,
  discoveryCandidates: candidates,
}));

import { GET as status } from '../config-status/route';
import { POST as save } from '../config/route';
import { DELETE as remove } from '../config/route';
import { POST as test } from '../test/route';
import { POST as discover } from '../discover/route';
import { GET as appleTv } from '../apple-tv/route';
import { GET as mediaPlayer } from '../media-player/route';

const config = {
  baseUrl: 'http://ha.local',
  accessToken: 'secret',
  mediaPlayerEntityId: 'media_player.tv',
  remoteEntityId: 'remote.tv',
};
const request = (body: unknown) =>
  new NextRequest('http://localhost/api/integrations/home-assistant', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
const ok = (body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  jest.clearAllMocks();
  auth.mockResolvedValue({ user: { id: 'u1' } });
  displayAuth.mockResolvedValue({ user: { id: 'u1' } });
  role.mockReturnValue(null);
  haFetch.mockResolvedValue(ok());
  saveConfig.mockResolvedValue(undefined);
  deleteConfig.mockResolvedValue(undefined);
});

describe('Home Assistant routes', () => {
  it('returns config status without exposing the token', async () => {
    getConfig.mockResolvedValue(config);
    const body = await (await status()).json();
    expect(body).toEqual({
      configured: true,
      baseUrl: config.baseUrl,
      mediaPlayerEntityId: config.mediaPlayerEntityId,
      remoteEntityId: config.remoteEntityId,
      hasToken: true,
    });
    expect(body.accessToken).toBeUndefined();
  });

  it('tests connectivity before saving and deletes through persistence helper', async () => {
    const response = await save(request(config));
    expect(response.status).toBe(200);
    expect(haFetch).toHaveBeenCalledWith(config, '/api/states');
    expect(saveConfig).toHaveBeenCalledWith(config);
    const fetchOrder = haFetch.mock.invocationCallOrder[0];
    const saveOrder = saveConfig.mock.invocationCallOrder[0];
    if (fetchOrder === undefined || saveOrder === undefined)
      throw new Error('Expected both calls to be recorded');
    expect(fetchOrder).toBeLessThan(saveOrder);
    await remove();
    expect(deleteConfig).toHaveBeenCalledTimes(1);
  });

  it('does not persist when the connectivity test fails', async () => {
    haFetch.mockResolvedValue(new Response(null, { status: 401 }));
    const response = await save(request(config));
    expect(response.status).toBe(401);
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it('tests without persisting and projects discovery results', async () => {
    const testResponse = await test(request(config));
    expect(testResponse.status).toBe(200);
    expect(saveConfig).not.toHaveBeenCalled();
    const states = [
      { entity_id: 'media_player.tv', attributes: { access_token: 'must-not-return' } },
    ];
    haFetch.mockResolvedValue(ok(states));
    candidates.mockReturnValue([{ entity_id: 'media_player.tv' }]);
    const response = await discover(
      request({ baseUrl: config.baseUrl, accessToken: config.accessToken })
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ candidates: [{ entity_id: 'media_player.tv' }] });
    expect(JSON.stringify(body)).not.toContain('must-not-return');
  });

  it('rejects unauthorized and forbidden mutations before network access', async () => {
    auth.mockResolvedValueOnce(new NextResponse('Unauthorized', { status: 401 }));
    expect((await save(request(config))).status).toBe(401);
    auth.mockResolvedValue({ user: { id: 'u1' } });
    role.mockReturnValueOnce(new NextResponse('Forbidden', { status: 403 }));
    expect((await test(request(config))).status).toBe(403);
    expect(haFetch).not.toHaveBeenCalled();
    role.mockReturnValueOnce(new NextResponse('Forbidden', { status: 403 }));
    expect((await discover(request(config))).status).toBe(403);
    expect(haFetch).not.toHaveBeenCalled();
  });

  it('returns Home Assistant position with its source timestamp and a current end time', async () => {
    getConfig.mockResolvedValue(config);
    haFetch.mockResolvedValue(
      ok({
        entity_id: config.mediaPlayerEntityId,
        state: 'playing',
        attributes: {
          friendly_name: 'Living Room',
          media_title: 'Film',
          media_position: 30,
          media_duration: 120,
          supported_features: 3,
          media_position_updated_at: '2026-09-03T11:59:50Z',
        },
      })
    );
    const response = await appleTv();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.position).toBe(30);
    expect(body.deviceName).toBe('Living Room');
    expect(body.positionUpdatedAt).toBe('2026-09-03T11:59:50Z');
    expect(body.endTime).toEqual(expect.any(String));
  });

  it('versions artwork URLs without exposing the Home Assistant picture path', async () => {
    getConfig.mockResolvedValue(config);
    const picturePath = '/api/media_player_proxy/media_player.tv?token=secret';
    haFetch.mockResolvedValue(
      ok({
        entity_id: config.mediaPlayerEntityId,
        state: 'playing',
        attributes: { media_title: 'Film', entity_picture: picturePath },
      })
    );

    const body = await (await appleTv()).json();
    expect(body.artworkUrl).toMatch(
      /^\/api\/integrations\/home-assistant\/apple-tv\/artwork\?v=[a-f0-9]{12}$/
    );
    expect(JSON.stringify(body)).not.toContain(picturePath);
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('returns a safe service label for logo artwork when Home Assistant has no picture', async () => {
    getConfig.mockResolvedValue(config);
    haFetch.mockResolvedValue(
      ok({
        entity_id: config.mediaPlayerEntityId,
        state: 'playing',
        attributes: { media_title: 'Video', app_name: 'YouTube' },
      })
    );

    const body = await (await mediaPlayer()).json();
    expect(body.artworkUrl).toBeNull();
    expect(body.mediaService).toBe('youtube');
  });

  it('exposes an opaque media identity without returning media_content_id', async () => {
    getConfig.mockResolvedValue(config);
    const rawMediaId = 'provider://film?token=must-not-leak';
    haFetch.mockResolvedValue(
      ok({
        entity_id: config.mediaPlayerEntityId,
        state: 'playing',
        attributes: { media_title: 'Film', media_content_id: rawMediaId },
      })
    );

    const body = await (await mediaPlayer()).json();
    expect(body.mediaIdentity).toMatch(/^[a-f0-9]{32}$/);
    expect(body.mediaContentId).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(rawMediaId);
    expect(JSON.stringify(body)).not.toContain('must-not-leak');
  });

  it('rejects scoped voice tokens from Apple TV control while allowing wildcard tokens', async () => {
    displayAuth.mockResolvedValueOnce({ userId: 'u1', role: 'parent', scopes: ['voice'] });
    expect(
      (await (await import('../apple-tv/action/route')).POST(request({ control: 'pause' }))).status
    ).toBe(403);
    expect(haFetch).not.toHaveBeenCalled();

    displayAuth.mockResolvedValueOnce({ userId: 'u1', role: 'parent', scopes: ['*'] });
    getConfig.mockResolvedValue(config);
    haFetch.mockResolvedValueOnce(
      ok({
        entity_id: config.mediaPlayerEntityId,
        state: 'playing',
        attributes: { supported_features: 1 },
      })
    );
    haFetch.mockResolvedValueOnce(ok());
    expect(
      (await (await import('../apple-tv/action/route')).POST(request({ control: 'pause' }))).status
    ).toBe(200);
  });
});
