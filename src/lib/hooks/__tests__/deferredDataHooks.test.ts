/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useChores } from '../useChores';
import { usePhotos } from '../usePhotos';
import { useRecipes } from '../useRecipes';
import { useShoppingLists } from '../useShoppingLists';
import { useTaskLists } from '../useTaskLists';
import { useVisibilityPolling } from '../useVisibilityPolling';
import { navCacheGet } from '@/lib/utils/navCache';

jest.mock('../useVisibilityPolling', () => ({
  useVisibilityPolling: jest.fn(),
}));

jest.mock('@/lib/utils/navCache', () => ({
  navCacheGet: jest.fn(),
  navCacheSet: jest.fn(),
}));

const mockFetch = jest.fn();
const mockPolling = useVisibilityPolling as jest.MockedFunction<typeof useVisibilityPolling>;
const mockCacheGet = navCacheGet as jest.MockedFunction<typeof navCacheGet>;

function response(json: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => json } as Response);
}

describe('deferred data hooks', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockPolling.mockClear();
    mockCacheGet.mockReturnValue(undefined);
    global.fetch = mockFetch;
  });

  it('does not fetch photos or poll while disabled', async () => {
    const { result } = renderHook(() =>
      usePhotos({ enabled: false, refreshInterval: 5_000 })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockPolling).toHaveBeenLastCalledWith(expect.any(Function), 0);
  });

  it('fetches photos when enabled later', async () => {
    mockFetch.mockImplementation(() => response({ photos: [], total: 0 }));
    const { rerender } = renderHook(
      ({ enabled }) => usePhotos({ enabled, usage: 'wallpaper', limit: 1 }),
      { initialProps: { enabled: false } }
    );

    expect(mockFetch).not.toHaveBeenCalled();
    rerender({ enabled: true });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/photos?usage=wallpaper&sort=chronological&limit=1&offset=0'
      );
    });
  });

  it('disables photo polling without losing the configured interval', async () => {
    mockFetch.mockImplementation(() => response({ photos: [], total: 0 }));
    const { result, rerender } = renderHook(
      ({ enabled }) => usePhotos({ enabled, refreshInterval: 8_000 }),
      { initialProps: { enabled: false } }
    );

    expect(mockPolling).toHaveBeenLastCalledWith(expect.any(Function), 0);
    rerender({ enabled: true });
    expect(mockPolling).toHaveBeenLastCalledWith(expect.any(Function), 8_000);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('does not fetch task lists until enabled', async () => {
    mockFetch.mockImplementation(() => response([]));
    const { result, rerender } = renderHook(
      ({ enabled }) => useTaskLists({ enabled }),
      { initialProps: { enabled: false } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/task-lists'));
  });

  it('does not fetch recipes until enabled', async () => {
    mockFetch.mockImplementation(() => response({ recipes: [], total: 0 }));
    const { result, rerender } = renderHook(
      ({ enabled }) => useRecipes({ enabled, category: 'Dinner' }),
      { initialProps: { enabled: false } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/recipes?category=Dinner');
    });
  });

  it('reports task-list fetch failures', async () => {
    mockFetch.mockImplementation(() => response({}, false));
    const { result } = renderHook(() => useTaskLists());

    await waitFor(() => expect(result.current.error).toBe('Failed to fetch task lists'));
    expect(result.current.loading).toBe(false);
  });

  it('reports recipe fetch failures', async () => {
    mockFetch.mockImplementation(() => response({}, false));
    const { result } = renderHook(() => useRecipes());

    await waitFor(() => expect(result.current.error).toBe('Failed to fetch recipes'));
    expect(result.current.loading).toBe(false);
  });

  it('does not rerender chores for an unchanged background response', async () => {
    mockFetch.mockImplementation(() => response({ chores: [] }));
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useChores();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    const rendersAfterInitialLoad = renderCount;

    await act(async () => {
      await result.current.refresh();
    });

    expect(renderCount).toBe(rendersAfterInitialLoad);
  });

  it('does not rerender shopping lists for an unchanged background response', async () => {
    mockFetch.mockImplementation(() => response({ lists: [] }));
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useShoppingLists();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    const rendersAfterInitialLoad = renderCount;

    await act(async () => {
      await result.current.refresh();
    });

    expect(renderCount).toBe(rendersAfterInitialLoad);
  });
});
