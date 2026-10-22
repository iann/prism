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

/**
 * The house-wide mode toggles (Babysitter, Away) are read by several
 * independent components at once — the overlay that performs the change and the
 * dashboard button are different instances with their own copy of the state.
 * A change therefore has to broadcast so the others refresh instead of waiting
 * out their poll interval. Enabling used to dispatch that from the button and
 * exiting forgot to, so the button stayed hidden for up to a poll after exit
 * (#665). The broadcast now lives in toggle() itself, on the one path every
 * change flows through; these tests pin that.
 */
describe('useModeToggle broadcast', () => {
  const broadcastOptions = {
    endpoint: '/api/babysitter-mode',
    eventName: 'prism:babysitter-mode-change',
    label: 'babysitter mode',
  };

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

  it.each([
    ['exit', false],
    ['enter', true],
  ])('broadcasts the change event when toggling %s (#665)', async (_label, enabled) => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled, enabledAt: null, enabledBy: null }),
    });
    const listener = jest.fn();
    window.addEventListener(broadcastOptions.eventName, listener);
    const { result } = renderHook(() => useModeToggle(broadcastOptions));

    await act(async () => {
      await result.current.toggle(enabled);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      broadcastOptions.endpoint,
      expect.objectContaining({ method: 'POST' })
    );
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(broadcastOptions.eventName, listener);
  });

  it('does not broadcast when the toggle request fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'nope' }),
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const listener = jest.fn();
    window.addEventListener(broadcastOptions.eventName, listener);
    const { result } = renderHook(() => useModeToggle(broadcastOptions));

    await act(async () => {
      await expect(result.current.toggle(true)).rejects.toThrow();
    });

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(broadcastOptions.eventName, listener);
    consoleError.mockRestore();
  });
});
