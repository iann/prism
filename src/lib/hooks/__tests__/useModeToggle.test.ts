/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useFetch } from '../useFetch';
import { useModeToggle } from '../useModeToggle';

jest.mock('../useFetch', () => ({ useFetch: jest.fn() }));

const mockUseFetch = useFetch as jest.MockedFunction<typeof useFetch>;
const setData = jest.fn();
const refresh = jest.fn();
const fetchMock = jest.fn();

const options = {
  endpoint: '/api/quiet-mode',
  eventName: 'prism:quiet-mode-change',
  label: 'quiet mode',
};

describe('useModeToggle', () => {
  beforeEach(() => {
    setData.mockReset();
    refresh.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock;
    mockUseFetch.mockReturnValue({
      data: { enabled: false, enabledAt: null, enabledBy: null },
      setData,
      loading: false,
      error: null,
      refresh,
    });
  });

  it('uses event details without another API refresh', () => {
    renderHook(() => useModeToggle(options));
    const state = { enabled: true, enabledAt: '2026-07-15T12:00:00Z', enabledBy: 'Ian' };

    act(() => window.dispatchEvent(new CustomEvent(options.eventName, { detail: state })));

    expect(setData).toHaveBeenCalledWith(state);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes for legacy events without details', () => {
    renderHook(() => useModeToggle(options));

    act(() => window.dispatchEvent(new Event(options.eventName)));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(setData).not.toHaveBeenCalled();
  });

  it('broadcasts the server result after toggling', async () => {
    const state = { enabled: true, enabledAt: null, enabledBy: 'Ian' };
    fetchMock.mockResolvedValue({ ok: true, json: async () => state });
    const { result } = renderHook(() => useModeToggle(options));

    await act(() => result.current.toggle(true));

    expect(fetchMock).toHaveBeenCalledWith(options.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    expect(setData).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenCalledWith(state);
  });

  it('surfaces server errors', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Not allowed' }),
    });
    const { result } = renderHook(() => useModeToggle(options));

    await act(async () => {
      await expect(result.current.toggle(true)).rejects.toThrow('Not allowed');
    });
    expect(result.current.error).toBe('Not allowed');
    consoleError.mockRestore();
  });
});
