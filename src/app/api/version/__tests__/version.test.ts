import { APP_BUILD_ID, APP_VERSION } from '@/lib/constants';
import { GET } from '../route';

describe('GET /api/version', () => {
  it('returns the running application version without allowing caches', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: APP_VERSION, buildId: APP_BUILD_ID });
    expect(response.headers.get('cache-control')).toBe(
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    expect(response.headers.get('pragma')).toBe('no-cache');
  });
});
