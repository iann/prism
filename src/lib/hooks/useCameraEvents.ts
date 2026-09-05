'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type CameraEventKind = 'doorbell' | 'motion';

export type CameraEvent = {
  eventId: string;
  cameraId: string;
  cameraName: string;
  kind: CameraEventKind;
  occurredAt: string;
  receivedAt?: string;
  /** The capture time supplied by the camera, when the adapter knows it. */
  snapshotCapturedAt?: string | null;
  /** A Prism snapshot route. Upstream camera URLs are deliberately not accepted. */
  snapshotUrl: string;
  /** The server-side event expiry. This is never extended by a reconnect. */
  expiresAt: string;
  /** Absolute cap for one continuous automatic alert episode. */
  hardExpiresAt: string;
  /** Used when coalescing multiple motion events from one camera. */
  episodeStartedAt: string;
  lastActivityAt?: string;
};

export type CameraEventState = {
  events: CameraEvent[];
  revision: string | number | null;
  displayGrantId: string | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
};

export type UseCameraEventsOptions = {
  enabled?: boolean;
  /** Allows tests and an enrolled display to scope the dismissal cache. */
  storageScope?: string | null;
};

const MOTION_COALESCE_MS = 10_000;
const AUTO_EPISODE_MS = 120_000;
const RING_VISIBLE_MS = 60_000;
const MOTION_VISIBLE_MS = 30_000;
const KEEP_OPEN_MS = 5 * 60_000;
const DISMISSED_STORAGE_PREFIX = 'prism.camera-alerts.dismissed.v1';

type ReducerAction =
  | { type: 'sync'; events: CameraEvent[]; revision?: string | number | null; now?: number }
  | { type: 'event'; event: CameraEvent; revision?: string | number | null; now?: number }
  | { type: 'remove'; eventId: string; revision?: string | number | null }
  | { type: 'dismiss'; eventId: string }
  | { type: 'keep-open'; eventId: string; now?: number }
  | { type: 'expire'; now?: number };

type InternalEvent = CameraEvent & {
  displayExpiresAt: string;
};

type InternalState = {
  events: InternalEvent[];
  revision: string | number | null;
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asDate(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function safeSnapshotUrl(cameraId: string, value: unknown): string {
  // The browser must only ever receive a same-origin Prism route. The backend
  // may omit this field entirely; the configured camera route remains usable.
  if (typeof value === 'string' && /^\/api\/cameras\/[a-z0-9-]+\/snapshot$/.test(value)) return value;
  return `/api/cameras/${encodeURIComponent(cameraId)}/snapshot`;
}

function normalizeKind(value: unknown): CameraEventKind | null {
  if (value === 'doorbell' || value === 'ring' || value === 'ringing') return 'doorbell';
  if (value === 'motion' || value === 'person') return 'motion';
  return null;
}

/**
 * Normalize the intentionally small event envelope returned by the camera
 * API. Keeping this at the edge lets the UI tolerate the active snapshot and
 * SSE messages using either `event` or `events` without inventing a second
 * client-side event protocol.
 */
export function normalizeCameraEvent(raw: unknown, now = Date.now()): CameraEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const eventId = asString(value.eventId) || asString(value.id);
  const cameraId = asString(value.cameraId) || asString(value.camera_id);
  const kind = normalizeKind(value.kind || value.type || value.reason);
  if (!eventId || !cameraId || !kind) return null;

  const occurredAtMs = asDate(value.occurredAt || value.occurred_at, now);
  const episodeStartedMs = asDate(value.episodeStartedAt || value.episode_started_at, occurredAtMs);
  const defaultVisibleMs = kind === 'doorbell' ? RING_VISIBLE_MS : MOTION_VISIBLE_MS;
  const defaultExpiry = occurredAtMs + defaultVisibleMs;
  const serverExpiry = asDate(value.expiresAt || value.expires_at, defaultExpiry);
  const hardExpiry = Math.max(
    Math.min(asDate(value.hardExpiresAt || value.hard_expires_at, episodeStartedMs + AUTO_EPISODE_MS), episodeStartedMs + AUTO_EPISODE_MS),
    occurredAtMs,
  );
  const expiresMs = Math.min(serverExpiry, hardExpiry);
  const snapshot = value.snapshot && typeof value.snapshot === 'object'
    ? (value.snapshot as Record<string, unknown>)
    : null;

  return {
    eventId,
    cameraId,
    cameraName:
      asString(value.cameraName) ||
      asString(value.camera_name) ||
      asString(value.name) ||
      cameraId,
    kind,
    occurredAt: new Date(occurredAtMs).toISOString(),
    receivedAt: asString(value.receivedAt) || asString(value.received_at) || undefined,
    snapshotCapturedAt:
      asString(value.snapshotCapturedAt) ||
      asString(value.snapshot_captured_at) ||
      asString(snapshot?.capturedAt) ||
      null,
    snapshotUrl: safeSnapshotUrl(cameraId, value.snapshotUrl || value.snapshot_url || snapshot?.url),
    expiresAt: new Date(expiresMs).toISOString(),
    hardExpiresAt: new Date(hardExpiry).toISOString(),
    episodeStartedAt: new Date(episodeStartedMs).toISOString(),
    lastActivityAt: asString(value.lastActivityAt) || asString(value.last_activity_at) || undefined,
  };
}

function toInternal(event: CameraEvent, displayExpiresAt = event.expiresAt): InternalEvent {
  return { ...event, displayExpiresAt };
}

function sortEvents(events: InternalEvent[]): InternalEvent[] {
  return [...events].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'doorbell' ? -1 : 1;
    return Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
  });
}

function isExpired(event: InternalEvent, now: number): boolean {
  return Date.parse(event.displayExpiresAt) <= now || Date.parse(event.hardExpiresAt) <= now;
}

function reduce(state: InternalState, action: ReducerAction): InternalState {
  const now = 'now' in action ? action.now ?? Date.now() : Date.now();
  if (action.type === 'expire') {
    return { ...state, events: sortEvents(state.events.filter((event) => !isExpired(event, now))) };
  }
  if (action.type === 'dismiss') {
    return { ...state, events: state.events.filter((event) => event.eventId !== action.eventId) };
  }
  if (action.type === 'remove') {
    return {
      events: state.events.filter((event) => event.eventId !== action.eventId),
      revision: action.revision === undefined ? state.revision : action.revision,
    };
  }
  if (action.type === 'keep-open') {
    return {
      ...state,
      events: state.events.map((event) => {
        if (event.eventId !== action.eventId) return event;
        const hardExpiry = Date.parse(event.hardExpiresAt);
        const nextExpiry = Math.min(hardExpiry, now + KEEP_OPEN_MS);
        return { ...event, displayExpiresAt: new Date(nextExpiry).toISOString() };
      }),
    };
  }

  const incoming = action.type === 'sync' ? action.events : [action.event];
  const events = action.type === 'sync' ? [] : [...state.events];
  for (const event of incoming) {
    if (isExpired(toInternal(event), now)) continue;
    const existingIndex = events.findIndex((item) => item.eventId === event.eventId);
    if (existingIndex >= 0) {
      const previous = events[existingIndex]!;
      // The server keeps the original event ID while coalescing a motion
      // episode. A genuinely repeated delivery has the same activity and
      // expiry; a coalesced update carries a newer lastActivityAt and should
      // refresh the visible deadline within the existing hard cap.
      if (event.lastActivityAt && event.lastActivityAt !== previous.lastActivityAt) {
        events[existingIndex] = {
          ...event,
          episodeStartedAt: previous.episodeStartedAt,
          hardExpiresAt: previous.hardExpiresAt,
          displayExpiresAt: event.expiresAt,
        };
      }
      continue;
    }

    const previousMotionIndex = event.kind === 'motion'
      ? events.findIndex((item) => item.cameraId === event.cameraId && item.kind === 'motion' && now - Date.parse(item.occurredAt) <= MOTION_COALESCE_MS)
      : -1;
    if (previousMotionIndex >= 0) {
      const previous = events[previousMotionIndex]!;
      const hardExpiry = Math.min(Date.parse(previous.hardExpiresAt), Date.parse(event.hardExpiresAt));
      const visibleExpiry = Math.min(Date.parse(event.expiresAt), hardExpiry);
      events[previousMotionIndex] = {
        ...event,
        episodeStartedAt: previous.episodeStartedAt,
        hardExpiresAt: new Date(hardExpiry).toISOString(),
        expiresAt: new Date(visibleExpiry).toISOString(),
        displayExpiresAt: new Date(visibleExpiry).toISOString(),
        lastActivityAt: event.occurredAt,
      };
      continue;
    }
    events.push(toInternal(event));
  }
  return {
    events: sortEvents(events.filter((event) => !isExpired(event, now))),
    revision: action.revision === undefined ? state.revision : action.revision,
  };
}

export function cameraEventPriority(event: Pick<CameraEvent, 'kind' | 'occurredAt'>): number {
  return (event.kind === 'doorbell' ? 1_000_000_000_000 : 0) + Date.parse(event.occurredAt);
}

export function choosePrimaryCameraEvent(events: CameraEvent[]): CameraEvent | null {
  return [...events].sort((a, b) => cameraEventPriority(b) - cameraEventPriority(a))[0] || null;
}

function extractEvents(payload: unknown, now = Date.now()): CameraEvent[] {
  if (Array.isArray(payload)) return payload.map((item) => normalizeCameraEvent(item, now)).filter((item): item is CameraEvent => Boolean(item));
  if (!payload || typeof payload !== 'object') return [];
  const value = payload as Record<string, unknown>;
  const raw = Array.isArray(value.events)
    ? value.events
    : Array.isArray(value.active)
      ? value.active
      : Array.isArray(value.activeEvents)
        ? value.activeEvents
        : value.event
          ? [value.event]
          : value.data && typeof value.data === 'object' && !Array.isArray(value.data)
            ? extractEvents(value.data, now)
            : value.cameraId || value.camera_id
              ? [value]
              : [];
  if (value.data && typeof value.data === 'object' && !Array.isArray(value.data)) {
    const nested = extractEvents(value.data, now);
    if (nested.length) return nested;
  }
  return raw.map((item) => normalizeCameraEvent(item, now)).filter((item): item is CameraEvent => Boolean(item));
}

function extractRevision(payload: unknown): string | number | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  return typeof value.revision === 'string' || typeof value.revision === 'number' ? value.revision : null;
}

function extractGrantId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  return asString(value.displayGrantId) || asString(value.display_grant_id) || asString(value.grantId);
}

function storageKey(scope: string | null): string {
  return `${DISMISSED_STORAGE_PREFIX}.${scope || 'display'}`;
}

function loadDismissed(scope: string | null): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(storageKey(scope)) || '{}') as Record<string, unknown>;
    const now = Date.now();
    return new Set(Object.entries(parsed).filter(([, expiry]) => typeof expiry === 'number' && expiry > now).map(([id]) => id));
  } catch {
    return new Set();
  }
}

function saveDismissed(scope: string | null, ids: Set<string>, expiryById: Map<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const values: Record<string, number> = {};
    ids.forEach((id) => {
      const expiry = expiryById.get(id);
      if (expiry && expiry > now) values[id] = expiry;
    });
    window.sessionStorage.setItem(storageKey(scope), JSON.stringify(values));
  } catch {
    // Session storage is a convenience only; the server remains authoritative.
  }
}

export function useCameraEvents({ enabled = true, storageScope = null }: UseCameraEventsOptions = {}) {
  const [internal, setInternal] = useState<InternalState>({ events: [], revision: null });
  const [state, setState] = useState<Pick<CameraEventState, 'displayGrantId' | 'connected' | 'loading' | 'error'>>({
    displayGrantId: null,
    connected: false,
    loading: enabled,
    error: null,
  });
  const dismissedRef = useRef<Set<string>>(new Set());
  const dismissedExpiryRef = useRef(new Map<string, number>());
  const grantIdRef = useRef<string | null>(null);

  useEffect(() => {
    grantIdRef.current = null;
    dismissedRef.current = loadDismissed(storageScope);
    dismissedExpiryRef.current = new Map();
  }, [storageScope]);

  const dispatchEvents = useCallback((action: ReducerAction) => {
    setInternal((current) => {
      const next = reduce(current, action);
      if (action.type === 'sync' || action.type === 'event') {
        next.events = next.events.filter((event) => !dismissedRef.current.has(event.eventId));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setState((current) => ({ ...current, loading: false, connected: false }));
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    dismissedRef.current = loadDismissed(storageScope);
    setState((current) => ({ ...current, loading: true, error: null }));

    const connect = async () => {
      try {
        const response = await fetch('/api/cameras/active', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (cancelled) return;
        // A display without an enrollment is expected to receive 401/403.
        // Treat that as an inactive feature rather than a noisy app error.
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          setState((current) => ({ ...current, loading: false, connected: false, error: null }));
          return;
        }
        if (!response.ok) throw new Error(`Camera status unavailable (${response.status})`);
        const payload: unknown = await response.json();
        if (cancelled) return;
        const nextGrant = extractGrantId(payload);
        if (nextGrant) {
          grantIdRef.current = nextGrant;
          dismissedRef.current = loadDismissed(storageScope || nextGrant);
        }
        setState((current) => ({
          ...current,
          loading: false,
          connected: true,
          error: null,
          displayGrantId: nextGrant || current.displayGrantId,
        }));
        dispatchEvents({ type: 'sync', events: extractEvents(payload), revision: extractRevision(payload) });

        const source = new EventSource('/api/cameras/events/stream', { withCredentials: true });
        const onMessage = (message: MessageEvent<string>) => {
          try {
            const nextPayload: unknown = JSON.parse(message.data);
            const nextGrant = extractGrantId(nextPayload);
            if (nextGrant) {
              grantIdRef.current = nextGrant;
              setState((current) => ({ ...current, displayGrantId: nextGrant }));
            }
            if (nextPayload && typeof nextPayload === 'object') {
              const value = nextPayload as Record<string, unknown>;
              const eventId = asString(value.eventId) || asString(value.event_id);
              if ((value.type === 'remove' || value.type === 'expired') && eventId) {
                dispatchEvents({ type: 'remove', eventId, revision: extractRevision(nextPayload) });
                return;
              }
            }
            const events = extractEvents(nextPayload);
            if (events.length) {
              events.forEach((event) => dispatchEvents({ type: 'event', event, revision: extractRevision(nextPayload) }));
            } else if (nextPayload && typeof nextPayload === 'object' && (nextPayload as Record<string, unknown>).type === 'snapshot') {
              dispatchEvents({ type: 'sync', events, revision: extractRevision(nextPayload) });
            }
          } catch {
            // Ignore malformed server events; the next revision/snapshot repairs state.
          }
        };
        source.addEventListener('message', onMessage);
        source.addEventListener('camera-snapshot', onMessage as EventListener);
        source.addEventListener('camera-change', onMessage as EventListener);
        source.addEventListener('camera', onMessage as EventListener);
        source.addEventListener('camera-event', onMessage as EventListener);
        source.onopen = () => setState((current) => ({ ...current, connected: true, loading: false, error: null }));
        source.onerror = () => {
          // EventSource reconnects itself. Keep an existing card visible until
          // its server deadline, while exposing a small status to diagnostics.
          setState((current) => ({ ...current, connected: false, loading: false }));
        };
        controller.signal.addEventListener('abort', () => source.close(), { once: true });
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        setState((current) => ({ ...current, loading: false, connected: false, error: 'Camera alerts unavailable' }));
      }
    };
    void connect();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dispatchEvents, enabled, storageScope]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => dispatchEvents({ type: 'expire' }), 1000);
    return () => window.clearInterval(timer);
  }, [dispatchEvents, enabled]);

  const dismiss = useCallback((eventId: string) => {
    const event = internal.events.find((item) => item.eventId === eventId);
    dismissedRef.current.add(eventId);
    if (event) dismissedExpiryRef.current.set(eventId, Date.parse(event.hardExpiresAt));
    saveDismissed(storageScope || grantIdRef.current, dismissedRef.current, dismissedExpiryRef.current);
    setInternal((current) => reduce(current, { type: 'dismiss', eventId }));
  }, [internal.events, storageScope]);

  const keepOpen = useCallback((eventId: string) => {
    setInternal((current) => reduce(current, { type: 'keep-open', eventId }));
  }, []);

  const events = useMemo(() => internal.events.map(({ displayExpiresAt: _displayExpiresAt, ...event }) => event), [internal.events]);

  return {
    events,
    revision: internal.revision,
    displayGrantId: state.displayGrantId,
    connected: state.connected,
    loading: state.loading,
    error: state.error,
    dismiss,
    keepOpen,
    refresh: () => window.fetch('/api/cameras/active', { credentials: 'include', cache: 'no-store' }).then(async (response) => {
      if (!response.ok) return;
      const payload: unknown = await response.json();
      setInternal((current) => reduce(current, { type: 'sync', events: extractEvents(payload), revision: extractRevision(payload) }));
    }),
  };
}
