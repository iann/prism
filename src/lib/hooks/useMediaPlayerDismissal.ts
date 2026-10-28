'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { parseStored, useHydrated, useStoredString, writeStored } from './useStoredValue';

export const MEDIA_PLAYER_DISMISSED_MEDIA_KEY =
  'prism:home-assistant-media-player-dismissed-media';

type StoredDismissal = {
  entityId: string;
  mediaIdentity: string;
};

export type MediaPlayerDismissalInput = {
  entityId: string | null | undefined;
  mediaIdentity: string | null | undefined;
  active: boolean;
  state: string | null | undefined;
  error?: string | null;
};

type PlaybackSnapshot = {
  entityId: string | null;
  mediaIdentity: string | null;
  active: boolean;
  state: string | null;
  sessionEnded: boolean;
  stableState: 'playing' | 'paused' | null;
};

function parseDismissal(stored: string | null): StoredDismissal | null {
  const parsed = parseStored(MEDIA_PLAYER_DISMISSED_MEDIA_KEY, stored);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as { entityId?: unknown }).entityId !== 'string' ||
    typeof (parsed as { mediaIdentity?: unknown }).mediaIdentity !== 'string' ||
    !(parsed as { entityId: string }).entityId ||
    !(parsed as { mediaIdentity: string }).mediaIdentity
  )
    return null;
  return parsed as StoredDismissal;
}

/** Keeps a dismissed media item hidden until content or the active playback session changes. */
export function useMediaPlayerDismissal({
  entityId,
  mediaIdentity,
  active,
  state,
  error,
}: MediaPlayerDismissalInput) {
  // The dismissal lives in localStorage, read through the shared store: it is
  // the server's null while hydrating, then this display's value.
  const storedDismissal = useStoredString(MEDIA_PLAYER_DISMISSED_MEDIA_KEY);
  const dismissedMedia = useMemo(() => parseDismissal(storedDismissal), [storedDismissal]);
  const dismissalReady = useHydrated();
  const previousSnapshot = useRef<PlaybackSnapshot | null>(null);

  const clearDismissal = useCallback(() => {
    writeStored(MEDIA_PLAYER_DISMISSED_MEDIA_KEY, null);
  }, []);

  useEffect(() => {
    if (!dismissalReady || error || state === 'unavailable') return;

    const previous = previousSnapshot.current;
    const currentState = state ?? null;
    const isSessionEnd = currentState === 'idle' || currentState === 'off';
    const isActiveState =
      active &&
      (currentState === 'playing' || currentState === 'paused' || currentState === 'buffering');

    if (isSessionEnd) {
      previousSnapshot.current = {
        entityId: entityId ?? null,
        mediaIdentity: mediaIdentity ?? null,
        active,
        state: currentState,
        sessionEnded: true,
        stableState: previous?.stableState ?? null,
      };
      clearDismissal();
      return;
    }

    if (!isActiveState) {
      previousSnapshot.current = {
        entityId: entityId ?? null,
        mediaIdentity: mediaIdentity ?? null,
        active,
        state: currentState,
        sessionEnded: previous?.sessionEnded ?? false,
        stableState: previous?.stableState ?? null,
      };
      return;
    }

    const currentMediaIdentity = mediaIdentity ?? null;
    const currentEntityId = entityId ?? null;
    const mediaChanged = Boolean(
      previous?.mediaIdentity &&
        currentMediaIdentity &&
        (previous.mediaIdentity !== currentMediaIdentity || previous.entityId !== currentEntityId)
    );
    const resumedFromPause = currentState === 'playing' && previous?.stableState === 'paused';
    // A player can report an inactive/unknown state without exposing `idle` or
    // `off` (for example after a stop command). Treat a later active transition
    // as a new session, but never do this for the initial snapshot or while an
    // unavailable/error response is being held stale by useFetch.
    const freshActiveSession =
      previous?.sessionEnded === true || (previous != null && !previous.active && active);
    const storedMediaChanged = Boolean(
      dismissedMedia &&
        currentEntityId &&
        currentMediaIdentity &&
        (dismissedMedia.entityId !== currentEntityId ||
          dismissedMedia.mediaIdentity !== currentMediaIdentity)
    );

    if (mediaChanged || resumedFromPause || freshActiveSession || storedMediaChanged) {
      clearDismissal();
    }

    previousSnapshot.current = {
      entityId: currentEntityId,
      mediaIdentity: currentMediaIdentity,
      active,
      state: currentState,
      sessionEnded: false,
      stableState:
        currentState === 'playing' || currentState === 'paused'
          ? currentState
          : previous?.stableState ?? null,
    };
  }, [
    active,
    clearDismissal,
    dismissalReady,
    dismissedMedia,
    entityId,
    error,
    mediaIdentity,
    state,
  ]);

  const dismiss = useCallback(() => {
    if (!entityId || !mediaIdentity) return;

    // writeStored keeps the choice in memory when storage refuses, so the
    // session still stays dismissed.
    writeStored(MEDIA_PLAYER_DISMISSED_MEDIA_KEY, JSON.stringify({ entityId, mediaIdentity }));
  }, [entityId, mediaIdentity]);

  const dismissed = Boolean(
    dismissalReady &&
      dismissedMedia &&
      dismissedMedia.entityId === entityId &&
      dismissedMedia.mediaIdentity === mediaIdentity
  );

  return { ready: dismissalReady, dismissed, dismiss };
}
