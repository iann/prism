import { generateCameraGrantToken, hashCameraGrantToken } from '../auth';

describe('camera grant tokens', () => {
  it('generates 32-byte hex tokens and one-way digests', () => {
    const token = generateCameraGrantToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(hashCameraGrantToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashCameraGrantToken(token)).toBe(hashCameraGrantToken(token));
    expect(hashCameraGrantToken(token)).not.toBe(token);
  });
});
