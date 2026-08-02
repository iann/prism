import { fetchServerAppVersion, isNewerAppVersion } from '../appVersion';

describe('app version checks', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('recognizes a different server version as an update', () => {
    expect(isNewerAppVersion('1.10.0', '1.10.1')).toBe(true);
    expect(isNewerAppVersion('1.10.0', '1.10.0')).toBe(false);
    expect(isNewerAppVersion(undefined, '1.10.1')).toBe(false);
    expect(isNewerAppVersion('1.10.0', null)).toBe(false);
  });

  it('fetches the server version with cache protection', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ version: '1.10.1' }), { status: 200 }));

    await expect(fetchServerAppVersion()).resolves.toBe('1.10.1');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/version\?check=\d+$/), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
  });

  it('ignores failed or malformed version responses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(fetchServerAppVersion()).resolves.toBeNull();

    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: 42 }), { status: 200 }));
    await expect(fetchServerAppVersion()).resolves.toBeNull();
  });
});
