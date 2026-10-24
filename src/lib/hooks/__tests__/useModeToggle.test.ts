/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useFetch } from '../useFetch';
import { useModeToggle } from '../useModeToggle';

// Stub useFetch so the test exercises only useModeToggle's own logic (the POST,
// the local update, the broadcast) and not the polling/caching machinery.
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
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ enabled: false, enabledAt: null, enabledBy: null }) });
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

  it.each([
    ['exit', false],
    ['enter', true],
  ])('broadcasts the change event when toggling %s (#665)', async (_label, enabled) => {
    const listener = jest.fn();
    window.addEventListener(options.eventName, listener);
    const { result } = renderHook(() => useModeToggle(options));

    await act(async () => {
      await result.current.toggle(enabled);
    });

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(options.eventName, listener);
  });

  it('does not broadcast when the toggle request fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'nope' }),
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const listener = jest.fn();
    window.addEventListener(options.eventName, listener);
    const { result } = renderHook(() => useModeToggle(options));

    await act(async () => {
      await expect(result.current.toggle(true)).rejects.toThrow();
    });

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(options.eventName, listener);
    consoleError.mockRestore();
  });
});