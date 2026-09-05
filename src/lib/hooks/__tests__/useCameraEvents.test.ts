import {
  cameraEventPriority,
  choosePrimaryCameraEvent,
  normalizeCameraEvent,
} from '../useCameraEvents';

describe('camera event normalization', () => {
  it('accepts the event envelope and keeps snapshot URLs on Prism', () => {
    const event = normalizeCameraEvent({
      eventId: 'ring-1',
      cameraId: 'doorbell-1',
      cameraName: 'Front Door',
      kind: 'doorbell',
      occurredAt: '2026-09-05T18:30:00.000Z',
      snapshotUrl: 'https://camera.example/private.jpg',
    });

    expect(event).toMatchObject({
      eventId: 'ring-1',
      cameraName: 'Front Door',
      kind: 'doorbell',
      snapshotUrl: '/api/cameras/doorbell-1/snapshot',
    });
  });

  it('rejects unknown event kinds and malformed IDs', () => {
    expect(normalizeCameraEvent({ cameraId: 'doorbell-1', kind: 'person' })).toBeNull();
    expect(normalizeCameraEvent({ eventId: 'motion-1', kind: 'motion' })).toBeNull();
  });

  it('gives a newer ring priority over motion from another camera', () => {
    const motion = normalizeCameraEvent({
      eventId: 'motion-1', cameraId: 'floodlight-1', kind: 'motion', occurredAt: '2026-09-05T18:30:20Z',
    })!;
    const ring = normalizeCameraEvent({
      eventId: 'ring-1', cameraId: 'doorbell-1', kind: 'doorbell', occurredAt: '2026-09-05T18:29:00Z',
    })!;
    expect(cameraEventPriority(ring)).toBeGreaterThan(cameraEventPriority(motion));
    expect(choosePrimaryCameraEvent([motion, ring])).toEqual(ring);
  });
});
