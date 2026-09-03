/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { useAppleTvPlayback } from '../useAppleTvPlayback';

jest.mock('../useFetch', () => ({
  useFetch: jest.fn(() => ({
    data: { visible: false, active: false },
    loading: false,
    error: null,
    refresh: jest.fn(),
  })),
}));

it('polls every five seconds and posts actions through Prism', async () => {
  const { useFetch } = jest.requireMock('../useFetch') as { useFetch: jest.Mock };
  const refresh = jest.fn();
  useFetch.mockReturnValue({
    data: { visible: false, active: false },
    loading: false,
    error: null,
    refresh,
  });
  const originalFetch = global.fetch;
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  global.fetch = fetchMock;
  const { result } = renderHook(() => useAppleTvPlayback());
  expect(useFetch).toHaveBeenCalledWith(expect.objectContaining({ refreshInterval: 5000 }));
  await result.current.action({ control: 'volume_mute', isVolumeMuted: true });
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/action'),
    expect.objectContaining({
      body: JSON.stringify({ control: 'volume_mute', isVolumeMuted: true }),
    })
  );
  expect(refresh).toHaveBeenCalled();
  global.fetch = originalFetch;
});
