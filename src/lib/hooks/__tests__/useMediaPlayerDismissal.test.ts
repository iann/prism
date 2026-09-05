/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  MEDIA_PLAYER_DISMISSED_MEDIA_KEY,
  useMediaPlayerDismissal,
  type MediaPlayerDismissalInput,
} from '../useMediaPlayerDismissal';

const baseInput: MediaPlayerDismissalInput = {
  entityId: 'media_player.living_room',
  mediaIdentity: 'media-one',
  active: true,
  state: 'playing',
  error: null,
};

beforeEach(() => {
  localStorage.removeItem(MEDIA_PLAYER_DISMISSED_MEDIA_KEY);
});

it('persists dismissal for the current media and clears it for new media', () => {
  const { result, rerender } = renderHook((input: MediaPlayerDismissalInput) => useMediaPlayerDismissal(input), {
    initialProps: baseInput,
  });

  act(() => result.current.dismiss());
  expect(result.current.dismissed).toBe(true);
  expect(localStorage.getItem(MEDIA_PLAYER_DISMISSED_MEDIA_KEY)).toContain('media-one');

  rerender({ ...baseInput, mediaIdentity: 'media-two' });

  expect(result.current.dismissed).toBe(false);
  expect(localStorage.getItem(MEDIA_PLAYER_DISMISSED_MEDIA_KEY)).toBeNull();
});

it.each(['idle', 'off'] as const)('clears dismissal when the player becomes %s', (state) => {
  const { result, rerender } = renderHook((input: MediaPlayerDismissalInput) => useMediaPlayerDismissal(input), {
    initialProps: baseInput,
  });
  act(() => result.current.dismiss());

  rerender({ ...baseInput, active: false, state });

  expect(localStorage.getItem(MEDIA_PLAYER_DISMISSED_MEDIA_KEY)).toBeNull();
});

it('clears a paused dismissal when playback resumes through buffering', () => {
  const { result, rerender } = renderHook((input: MediaPlayerDismissalInput) => useMediaPlayerDismissal(input), {
    initialProps: { ...baseInput, state: 'paused' },
  });
  act(() => result.current.dismiss());

  rerender({ ...baseInput, state: 'buffering' });
  expect(localStorage.getItem(MEDIA_PLAYER_DISMISSED_MEDIA_KEY)).toContain('media-one');

  rerender({ ...baseInput, state: 'playing' });
  expect(localStorage.getItem(MEDIA_PLAYER_DISMISSED_MEDIA_KEY)).toBeNull();
});

it('preserves dismissal through unavailable responses', () => {
  const { result, rerender } = renderHook((input: MediaPlayerDismissalInput) => useMediaPlayerDismissal(input), {
    initialProps: baseInput,
  });
  act(() => result.current.dismiss());

  rerender({ ...baseInput, active: false, state: 'unavailable' });

  expect(result.current.dismissed).toBe(true);
  expect(localStorage.getItem(MEDIA_PLAYER_DISMISSED_MEDIA_KEY)).toContain('media-one');

  rerender({ ...baseInput, active: false, state: null, error: 'Home Assistant unavailable' });
  expect(localStorage.getItem(MEDIA_PLAYER_DISMISSED_MEDIA_KEY)).toContain('media-one');
});

it('shows the media again after an inactive session becomes active', () => {
  const { result, rerender } = renderHook((input: MediaPlayerDismissalInput) => useMediaPlayerDismissal(input), {
    initialProps: baseInput,
  });
  act(() => result.current.dismiss());

  rerender({ ...baseInput, active: false, state: null });
  rerender({ ...baseInput, active: true, state: 'playing' });

  expect(result.current.dismissed).toBe(false);
  expect(localStorage.getItem(MEDIA_PLAYER_DISMISSED_MEDIA_KEY)).toBeNull();
});
