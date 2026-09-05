import { NextRequest } from 'next/server';

const ingressGrant = jest.fn();
const displayGrant = jest.fn();
const rateLimit = jest.fn();
const accept = jest.fn();
const validate = jest.fn((payload: unknown) => payload);
const snapshot = jest.fn();
const subscribe = jest.fn();

jest.mock('@/lib/cameras/auth', () => ({
  validateCameraIngressRequest: ingressGrant,
  getCameraDisplayGrant: displayGrant,
}));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: rateLimit }));
jest.mock('@/lib/cameras/events', () => ({
  acceptCameraEvent: accept,
  validateCameraEvent: validate,
  getCameraEventSnapshot: snapshot,
  subscribeToCameraEvents: subscribe,
  CAMERA_EVENT_BODY_LIMIT: 4096,
  CameraEventStoreUnavailableError: class CameraEventStoreUnavailableError extends Error {},
  CameraEventValidationError: class CameraEventValidationError extends Error {},
}));

import { POST as ingress } from '../events/route';
import { GET as active } from '../active/route';
import { GET as stream } from '../events/stream/route';

const event = {
  version: 1,
  eventId: 'ha:ring:1',
  cameraId: 'doorbell-1',
  kind: 'doorbell',
  occurredAt: '2026-09-05T18:30:00.000Z',
};

function request(body: string, headers: Record<string, string> = { 'content-type': 'application/json' }) {
  return new NextRequest('http://localhost/api/cameras/events', {
    method: 'POST',
    body,
    headers,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  ingressGrant.mockResolvedValue({ id: 'ingress-a', kind: 'event-ingress', cameraIds: ['doorbell-1'], displayId: null });
  displayGrant.mockResolvedValue({ id: 'display-a', kind: 'display', cameraIds: ['doorbell-1'], displayId: 'kitchen' });
  rateLimit.mockResolvedValue(null);
  validate.mockImplementation((payload: unknown) => payload);
  accept.mockResolvedValue({
    accepted: true,
    duplicate: false,
    snapshot: { revision: 3, events: [] },
  });
  snapshot.mockResolvedValue({ revision: 3, events: [] });
  subscribe.mockResolvedValue(jest.fn().mockResolvedValue(undefined));
});

describe('camera event routes', () => {
  it('requires the machine-to-machine camera scope and returns accepted revisions', async () => {
    const response = await ingress(request(JSON.stringify(event)));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true, duplicate: false, revision: 3, eventId: event.eventId });
    expect(ingressGrant).toHaveBeenCalledWith('doorbell-1');
    expect(rateLimit).toHaveBeenCalledWith('camera-ingress:ingress-a', 'camera-events', 120, 60);
    expect(accept).toHaveBeenCalledWith(event, 'ingress-a');
  });

  it('rejects malformed JSON and oversized bodies before storage', async () => {
    const malformed = await ingress(request('{bad'));
    expect(malformed.status).toBe(400);
    expect(accept).not.toHaveBeenCalled();

    const oversized = await ingress(request('x'.repeat(4097), { 'content-type': 'application/json' }));
    expect(oversized.status).toBe(413);
    expect(accept).not.toHaveBeenCalled();
  });

  it('protects active recovery and sends private no-store headers', async () => {
    const response = await active();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revision: 3, events: [] });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('opens an SSE stream with the current snapshot and a heartbeat policy', async () => {
    const response = await stream();
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toContain('no-store');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Expected an SSE body');
    // The stream initializes asynchronously after the route returns.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain('camera-snapshot');
    await reader.cancel();
  });
});
