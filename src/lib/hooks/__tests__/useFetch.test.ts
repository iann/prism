/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useFetch } from '../useFetch';

jest.mock('../useVisibilityPolling', () => ({
  useVisibilityPolling: jest.fn(),
}));

const fetchMock = jest.fn();

function response(data: unknown) {
  return { ok: true, json: async () => data } as Response;
}

describe('useFetch', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('uses loading only for the initial request', async () => {
    fetchMock.mockResolvedValueOnce(response({ value: 1 }));
    const { result } = renderHook(() => useFetch({
      url: '/api/use-fetch-loading-test',
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
    fetchMock.mockResolvedValue(response({ value: 1 }));
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useFetch({
        url: '/api/use-fetch-equality-test',
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
    const { result } = renderHook(() => useFetch({
      url: '/api/use-fetch-disabled-test',
      initialData: [],
      enabled: false,
    }));

    expect(result.current.loading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
