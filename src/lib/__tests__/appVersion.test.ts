import { fetchServerBuildId, isDifferentBuild } from '../appVersion';

describe('app build checks', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('recognizes a different server build as an update', () => {
    expect(isDifferentBuild('build-a', 'build-b')).toBe(true);
    expect(isDifferentBuild('build-a', 'build-a')).toBe(false);
    expect(isDifferentBuild(undefined, 'build-b')).toBe(false);
    expect(isDifferentBuild('build-a', null)).toBe(false);
  });

  it('fetches the server build ID with cache protection', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ buildId: 'build-b' }), { status: 200 }));

    await expect(fetchServerBuildId()).resolves.toBe('build-b');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/version\?check=\d+$/), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
  });

  it('ignores failed or malformed build responses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(fetchServerBuildId()).resolves.toBeNull();

    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ buildId: 42 }), { status: 200 }));
    await expect(fetchServerBuildId()).resolves.toBeNull();
  });
});
