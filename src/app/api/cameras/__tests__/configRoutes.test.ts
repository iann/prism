import { NextRequest, NextResponse } from 'next/server';

const requireAuth = jest.fn();
const requireRole = jest.fn();
const getConfig = jest.fn();
const saveConfig = jest.fn();
const deleteConfig = jest.fn();
const validateConfig = jest.fn((value: unknown) => value);
const redactConfig = jest.fn((value: unknown) => ({ configured: Boolean(value) }));
const haFetch = jest.fn();
const candidates = jest.fn((value: unknown) => value);
const normalizeUrl = jest.fn((value: unknown) => String(value));
const createGrant = jest.fn();
const listGrants = jest.fn();
const revokeGrant = jest.fn();
const setCookie = jest.fn();
const clearCookie = jest.fn();
const displayGrant = jest.fn();

jest.mock('@/lib/auth', () => ({ requireAuth, requireRole }));
jest.mock('@/lib/integrations/homeAssistantCameraCredentials', () => ({
  getHomeAssistantCameraConfig: getConfig,
  saveHomeAssistantCameraConfig: saveConfig,
  deleteHomeAssistantCameraConfig: deleteConfig,
  validateHomeAssistantCameraConfig: validateConfig,
  redactHomeAssistantCameraConfig: redactConfig,
  homeAssistantCameraFetch: haFetch,
  cameraDiscoveryCandidates: candidates,
  normalizeHomeAssistantCameraUrl: normalizeUrl,
}));
jest.mock('@/lib/cameras/auth', () => ({
  createCameraGrant: createGrant,
  listCameraGrants: listGrants,
  revokeCameraGrant: revokeGrant,
  setCameraDisplayCookie: setCookie,
  clearCameraDisplayCookie: clearCookie,
  getCameraDisplayGrant: displayGrant,
}));

import { GET as getConfigRoute, POST as saveConfigRoute } from '../config/route';
import { POST as discoverRoute } from '../discover/route';
import { POST as ingressTokenRoute } from '../ingress-token/route';
import { POST as displayRoute } from '../displays/route';

const config = {
  enabled: true,
  baseUrl: 'http://ha.local',
  accessToken: 'secret',
  go2rtcBaseUrl: null,
  go2rtcAccessToken: null,
  cameras: [{
    id: 'doorbell-1', name: 'Front Door', enabled: true,
    haCameraEntityId: 'camera.front', ringEntityId: null, motionEntityId: null,
    pictureEntityId: null, go2rtcAlias: null, targetDisplayId: 'kitchen', eventKinds: ['doorbell', 'motion'],
  }],
};

const request = (body: unknown) => new NextRequest('http://localhost/api/cameras', {
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
});

beforeEach(() => {
  jest.clearAllMocks();
  requireAuth.mockResolvedValue({ userId: 'u1', role: 'parent' });
  requireRole.mockReturnValue(null);
  getConfig.mockResolvedValue(config);
  haFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
  saveConfig.mockResolvedValue(undefined);
  listGrants.mockResolvedValue([]);
  revokeGrant.mockResolvedValue(true);
  createGrant.mockResolvedValue({
    rawToken: 'a'.repeat(64),
    grant: { id: 'grant-1', cameraIds: ['doorbell-1'], displayId: 'kitchen', expiresAt: new Date('2099-01-01') },
  });
});

describe('camera configuration and grant routes', () => {
  it('returns a redacted configuration and tests HA before saving', async () => {
    const response = await getConfigRoute();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ configured: true });

    const saved = await saveConfigRoute(request(config));
    expect(saved.status).toBe(200);
    expect(haFetch).toHaveBeenCalledWith(config, '/api/states', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(saveConfig).toHaveBeenCalledWith(config);
  });

  it('blocks settings mutations before network access', async () => {
    requireAuth.mockResolvedValueOnce(new NextResponse('Unauthorized', { status: 401 }));
    expect((await saveConfigRoute(request(config))).status).toBe(401);
    expect(haFetch).not.toHaveBeenCalled();
  });

  it('projects discovery and issues scoped one-time ingress/display grants', async () => {
    candidates.mockReturnValue([{ entity_id: 'camera.front' }]);
    const discovered = await discoverRoute(request({ baseUrl: config.baseUrl, accessToken: config.accessToken }));
    expect(await discovered.json()).toEqual({ candidates: [{ entity_id: 'camera.front' }] });

    const ingress = await ingressTokenRoute();
    expect(await ingress.json()).toMatchObject({ grantId: 'grant-1', token: 'a'.repeat(64) });
    expect(createGrant).toHaveBeenCalledWith(expect.objectContaining({ kind: 'event-ingress', cameraIds: ['doorbell-1'] }));

    const display = await displayRoute(request({ displayId: 'kitchen', cameraIds: ['doorbell-1'] }));
    expect(display.status).toBe(200);
    expect(setCookie).toHaveBeenCalledWith(expect.anything(), 'a'.repeat(64), expect.any(Date));
  });
});
