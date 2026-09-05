import {
  cameraDiscoveryCandidates,
  redactHomeAssistantCameraConfig,
  validateHomeAssistantCameraConfig,
} from '../homeAssistantCameraCredentials';
import type { HomeAssistantCameraConfig } from '../homeAssistantCameraCredentials';

const config: HomeAssistantCameraConfig = {
  enabled: true,
  baseUrl: 'https://ha.example.test',
  accessToken: 'ha-secret',
  go2rtcBaseUrl: 'https://media.example.test',
  go2rtcAccessToken: 'go2rtc-secret',
  cameras: [
    {
      id: 'doorbell-1',
      name: 'Front Door',
      enabled: true,
      haCameraEntityId: 'camera.front_door',
      ringEntityId: 'binary_sensor.front_door_ring',
      motionEntityId: 'binary_sensor.front_door_motion',
      pictureEntityId: 'camera.front_door',
      go2rtcAlias: 'front-door',
      targetDisplayId: 'kitchen',
      eventKinds: ['doorbell', 'motion'],
    },
  ],
};

describe('Home Assistant camera configuration', () => {
  it('validates and normalizes a camera mapping', () => {
    expect(validateHomeAssistantCameraConfig(config)).toEqual(config);
  });

  it('rejects duplicate IDs, arbitrary source URLs, and malformed entities', () => {
    expect(() => validateHomeAssistantCameraConfig({
      ...config,
      cameras: [config.cameras[0], { ...config.cameras[0], name: 'Second' }],
    })).toThrow('Camera IDs must be unique');
    expect(() => validateHomeAssistantCameraConfig({
      ...config,
      cameras: [{ ...config.cameras[0], haCameraEntityId: 'https://attacker.test/camera' }],
    })).toThrow('Invalid Home Assistant camera entity ID');
    expect(() => validateHomeAssistantCameraConfig({
      ...config,
      cameras: [{ ...config.cameras[0], go2rtcAlias: 'rtsp://attacker.test/live' }],
    })).toThrow('Invalid go2rtc alias');
    expect(() => validateHomeAssistantCameraConfig({
      ...config,
      baseUrl: 'https://user:secret@ha.example.test',
    })).toThrow('must not contain credentials');
  });

  it('redacts credentials while retaining operator mappings', () => {
    const redacted = redactHomeAssistantCameraConfig(config);
    expect(redacted).toMatchObject({
      configured: true,
      hasAccessToken: true,
      hasGo2rtcAccessToken: true,
      cameras: [{ id: 'doorbell-1', haCameraEntityId: 'camera.front_door' }],
    });
    expect(JSON.stringify(redacted)).not.toContain('ha-secret');
    expect(JSON.stringify(redacted)).not.toContain('go2rtc-secret');
  });

  it('projects discovery without leaking picture URLs or arbitrary attributes', () => {
    const candidates = cameraDiscoveryCandidates([
      {
        entity_id: 'camera.front_door',
        state: 'idle',
        attributes: {
          friendly_name: 'Front Door',
          entity_picture: '/api/camera_proxy/camera.front_door?token=secret',
        },
      },
      {
        entity_id: 'binary_sensor.front_door_motion',
        state: 'on',
        attributes: { device_class: 'motion' },
      },
      { entity_id: 'light.front_door', state: 'on', attributes: {} },
    ]);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({ entity_id: 'camera.front_door', likelyCamera: true });
    expect(candidates[1]).toMatchObject({ entity_id: 'binary_sensor.front_door_motion', likelyMotion: true });
    expect(JSON.stringify(candidates)).not.toContain('secret');
  });
});
