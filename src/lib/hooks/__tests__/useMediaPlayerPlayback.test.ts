/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { useMediaPlayerPlayback } from '../useMediaPlayerPlayback';

jest.mock('../useFetch', () => ({
  useFetch: jest.fn(() => ({
    data: { active: false, visible: false },
    loading: false,
    error: null,
    refresh: jest.fn(),
  })),
}));

it('polls the generic media-player route and posts generic actions', async () => {
  const { useFetch } = jest.requireMock('../useFetch') as { useFetch: jest.Mock };
  const refresh = jest.fn();
  useFetch.mockReturnValue({
    data: { active: false, visible: false },
    loading: false,
    error: null,
    refresh,
  });
  const originalFetch = global.fetch;
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  global.fetch = fetchMock;

  const { result } = renderHook(() => useMediaPlayerPlayback());

  expect(useFetch).toHaveBeenCalledWith(
    expect.objectContaining({
      url: '/api/integrations/home-assistant/media-player',
      refreshInterval: 5000,
      label: 'media-player playback',
    })
  );
  await result.current.action({ control: 'turn_off' });
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/integrations/home-assistant/media-player/action',
    expect.objectContaining({ body: JSON.stringify({ control: 'turn_off' }) })
  );
  expect(refresh).toHaveBeenCalled();
  global.fetch = originalFetch;
});
