'use client';

import { useSyncExternalStore } from 'react';

export const SCREEN_CLEANING_DURATION_MS = 60_000;

export type ScreenCleaningStatus = 'inactive' | 'cleaning' | 'finishing';

export type ScreenCleaningSnapshot = {
  readonly status: ScreenCleaningStatus;
  /** Absolute clock deadline; null while inactive. */
  readonly deadline: number | null;
  /** Clock-derived whole seconds remaining. Always zero while finishing. */
  readonly remainingSeconds: number;
};

const INACTIVE_SNAPSHOT: ScreenCleaningSnapshot = Object.freeze({
  status: 'inactive',
  deadline: null,
  remainingSeconds: 0,
});

let snapshot: ScreenCleaningSnapshot = INACTIVE_SNAPSHOT;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let wakeListenersInstalled = false;

function publish(next: ScreenCleaningSnapshot): void {
  if (
    next.status === snapshot.status &&
    next.deadline === snapshot.deadline &&
    next.remainingSeconds === snapshot.remainingSeconds
  ) {
    return;
  }

  snapshot = Object.freeze(next);
  for (const listener of listeners) listener();
}

function getSnapshot(): ScreenCleaningSnapshot {
  return snapshot;
}

function getServerSnapshot(): ScreenCleaningSnapshot {
  // A new document always begins inactive, including during server rendering.
  return INACTIVE_SNAPSHOT;
}

function getActiveServerSnapshot(): boolean {
  return false;
}

function clearTimer(): void {
  if (timer === null) return;
  clearTimeout(timer);
  timer = null;
}

function removeWakeListeners(): void {
  if (!wakeListenersInstalled || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  document.removeEventListener('visibilitychange', reconcileDeadline);
  window.removeEventListener('focus', reconcileDeadline);
  window.removeEventListener('pageshow', reconcileDeadline);
  wakeListenersInstalled = false;
}

function stopLifecycle(): void {
  clearTimer();
  removeWakeListeners();
}

function enterFinishing(): void {
  clearTimer();
  const current = snapshot;
  if (current.status !== 'cleaning') return;
  publish({
    status: 'finishing',
    deadline: current.deadline,
    remainingSeconds: 0,
  });
}

/**
 * Reconcile against the wall clock instead of decrementing a counter. This
 * remains correct when timers are delayed while the tab is asleep or hidden.
 */
function reconcileDeadline(): void {
  clearTimer();
  const current = snapshot;
  if (current.status !== 'cleaning' || current.deadline === null) return;

  const remainingMs = current.deadline - Date.now();
  if (remainingMs <= 0) {
    enterFinishing();
    return;
  }

  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  if (remainingSeconds !== current.remainingSeconds) {
    publish({
      status: 'cleaning',
      deadline: current.deadline,
      remainingSeconds,
    });
  }

  // Wake at the next visible whole-second boundary. The value itself always
  // comes from Date.now(), so delayed callbacks never accumulate drift.
  const nextBoundaryInMs = remainingMs - (remainingSeconds - 1) * 1000;
  timer = setTimeout(reconcileDeadline, Math.max(1, nextBoundaryInMs));
}

function installWakeListeners(): void {
  if (wakeListenersInstalled || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  document.addEventListener('visibilitychange', reconcileDeadline);
  window.addEventListener('focus', reconcileDeadline);
  window.addEventListener('pageshow', reconcileDeadline);
  wakeListenersInstalled = true;
}

/** Start one 60-second session. Further calls while protected do not extend it. */
export function startScreenCleaning(): void {
  if (snapshot.status !== 'inactive') return;

  const deadline = Date.now() + SCREEN_CLEANING_DURATION_MS;
  installWakeListeners();
  timer = setTimeout(reconcileDeadline, 1000);
  publish({
    status: 'cleaning',
    deadline,
    remainingSeconds: Math.ceil(SCREEN_CLEANING_DURATION_MS / 1000),
  });
}

/** Request a safe exit; the display stays protected until finish is confirmed. */
export function requestScreenCleaningExit(): void {
  if (snapshot.status === 'cleaning') enterFinishing();
}

/** Complete cleanup after the input guard confirms no contact can click through. */
export function finishScreenCleaning(): void {
  if (snapshot.status !== 'finishing') return;
  stopLifecycle();
  publish(INACTIVE_SNAPSHOT);
}

/** Reset the transient controller when its persistent host is removed. */
export function resetScreenCleaning(): void {
  stopLifecycle();
  publish(INACTIVE_SNAPSHOT);
}

/** Synchronous guard for native input handlers and other timer decisions. */
export function isScreenCleaningActive(): boolean {
  return snapshot.status !== 'inactive';
}

export function getScreenCleaningSnapshot(): ScreenCleaningSnapshot {
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Subscribe to the single in-memory cleaning controller. */
export function useScreenCleaning(): ScreenCleaningSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Subscribe to the active/inactive state without rerendering every countdown second. */
export function useScreenCleaningActive(): boolean {
  return useSyncExternalStore(subscribe, isScreenCleaningActive, getActiveServerSnapshot);
}
