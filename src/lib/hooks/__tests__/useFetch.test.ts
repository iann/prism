/**
 * @jest-environment jsdom
 */

/**
 * Tests for useFetch's mount/poll coordination and its stale-while-revalidate
 * behavior.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useFetch } from '../useFetch';
import { navCacheSet } from '@/lib/utils/navCache';

let urlSerial = 0;
function nextUrl(label: string): string {
  urlSerial += 1;
  return `/api/use-fetch-${label}-${urlSerial}`;
}

function jsonOnce(value: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(value) } as Response);
}

function response(value: unknown) {
  return { ok: true, json: async () => value } as Response;
}

describe('useFetch', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(() => jsonOnce({ enabled: false }));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const mount = (url: string) =>
    renderHook(() =>
      useFetch<{ enabled: boolean }>({
        url,
        initialData: { enabled: false },
        refreshInterval: 60_000,
      })
    );

  it('fetches on a cold mount', async () => {
    const { result } = mount(nextUrl('cold'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves a second instance of the same endpoint without a second request', async () => {
    const url = nextUrl('remount');
    const first = mount(url);
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    fetchMock.mockClear();

    const second = mount(url);
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(second.result.current.data).toEqual({ enabled: false });
  });

  it('skips a poll when another instance has just fetched, and polls when none has', async () => {
    jest.useFakeTimers();
    const url = nextUrl('poll');
    const { result } = mount(url);
    await act(async () => {});
    fetchMock.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(50_000);
      navCacheSet(url, { enabled: true });
      jest.advanceTimersByTime(10_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ enabled: true });
  });

  it('still goes to the network for an explicit refresh', async () => {
    const { result } = mount(nextUrl('refresh'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchMock.mockClear();

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses loading only for the initial request', async () => {
    fetchMock.mockResolvedValueOnce(response({ value: 1 }));
    const url = nextUrl('loading');
    const { result } = renderHook(() => useFetch({
      url,
      initialData: { value: 0 },
    }));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual({ value: 1 }));
    expect(result.current.loading).toBe(false);

    let finishRefresh: (value: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => {
      finishRefresh = resolve;
    }));

    let refresh: Promise<void> | undefined;
    act(() => {
      refresh = result.current.refresh();
    });
    expect(result.current.loading).toBe(false);

    await act(async () => {
      finishRefresh(response({ value: 2 }));
      await refresh;
    });
    expect(result.current.data).toEqual({ value: 2 });
    expect(result.current.loading).toBe(false);
  });

  it('preserves the data reference for unchanged responses', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(response({ value: 1 })));
    const url = nextUrl('equality');
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useFetch({
        url,
        initialData: { value: 0 },
      });
    });

    await waitFor(() => expect(result.current.data).toEqual({ value: 1 }));
    const first = result.current.data;
    const rendersAfterInitialLoad = renderCount;

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.data).toBe(first);
    expect(renderCount).toBe(rendersAfterInitialLoad);
  });

  it('does not report loading when disabled', () => {
    const url = nextUrl('disabled');
    const { result } = renderHook(() => useFetch({
      url,
      initialData: [],
      enabled: false,
    }));

    expect(result.current.loading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
