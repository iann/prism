'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import {
  finishScreenCleaning,
  getScreenCleaningSnapshot,
  isScreenCleaningActive,
  requestScreenCleaningExit,
  type ScreenCleaningStatus,
} from './useScreenCleaning';

// Browsers dispatch compatibility clicks immediately after pointer/touch up.
// Keep the shield active for that whole dispatch window before restoring input.
const FINISH_GRACE_MS = 700;
const LIFECYCLE_RECOVERY_MS = 1000;

/**
 * Installs the native capture guard for the persistent cleaning host. The
 * listeners stay mounted so protection is already in place when the shared
 * controller publishes its active state.
 */
export function useScreenCleaningInputGuard(status: ScreenCleaningStatus): number {
  const contactsRef = useRef(new Set<string>());
  const orphanedKeysRef = useRef(new Set<string>());
  const stalePhysicalContactsRef = useRef(new Set<string>());
  const orphanedPhysicalContactsRef = useRef(new Set<string>());
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lifecycleRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContactReleaseAtRef = useRef<number | null>(null);
  const pendingTrailingClickIdsRef = useRef(new Set<string>());
  const contactTargetsRef = useRef(new Map<string, EventTarget>());
  const orphanedPhysicalTargetsRef = useRef(new Map<string, EventTarget>());
  const [physicalContactCount, setPhysicalContactCount] = useState(0);

  useLayoutEffect(() => {
    const contacts = contactsRef.current;
    const orphanedKeys = orphanedKeysRef.current;
    const stalePhysicalContacts = stalePhysicalContactsRef.current;
    const orphanedPhysicalContacts = orphanedPhysicalContactsRef.current;
    const pendingTrailingClickIds = pendingTrailingClickIdsRef.current;
    const contactTargets = contactTargetsRef.current;
    const orphanedPhysicalTargets = orphanedPhysicalTargetsRef.current;
    const clearFinishTimer = () => {
      if (finishTimerRef.current === null) return;
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    };
    const clearLifecycleRecoveryTimer = () => {
      if (lifecycleRecoveryTimerRef.current === null) return;
      clearTimeout(lifecycleRecoveryTimerRef.current);
      lifecycleRecoveryTimerRef.current = null;
    };

    const scheduleFinish = (delayMs = FINISH_GRACE_MS) => {
      if (getScreenCleaningSnapshot().status !== 'finishing' || contacts.size > 0) return;
      clearFinishTimer();
      finishTimerRef.current = setTimeout(() => {
        finishTimerRef.current = null;
        if (contacts.size === 0) finishScreenCleaning();
      }, Math.max(0, delayMs));
    };

    const consume = (event: Event) => {
      if (event.cancelable) event.preventDefault();
      event.stopImmediatePropagation();
    };

    const updateContacts = (previousCount: number) => {
      const nextCount = contacts.size;
      const nextPhysicalCount = Array.from(contacts).filter(id =>
        id.startsWith('pointer:') || id.startsWith('mouse:') || id.startsWith('touch:')
      ).length;
      setPhysicalContactCount(current => current === nextPhysicalCount ? current : nextPhysicalCount);
      if (previousCount > 0 && nextCount === 0) lastContactReleaseAtRef.current = Date.now();
      if (nextCount > 0) clearFinishTimer();
      else if (getScreenCleaningSnapshot().status === 'finishing') scheduleFinish();
    };

    const addContact = (id: string, target?: EventTarget | null) => {
      const previousCount = contacts.size;
      stalePhysicalContacts.delete(id);
      orphanedPhysicalContacts.delete(id);
      pendingTrailingClickIds.delete(id);
      orphanedPhysicalTargets.delete(id);
      if (stalePhysicalContacts.size === 0) clearLifecycleRecoveryTimer();
      contacts.add(id);
      if (target) contactTargets.set(id, target);
      updateContacts(previousCount);
    };

    const removeContact = (id: string) => {
      const previousCount = contacts.size;
      const wasOrphaned = orphanedPhysicalContacts.delete(id);
      if (wasOrphaned) pendingTrailingClickIds.add(id);
      stalePhysicalContacts.delete(id);
      contacts.delete(id);
      contactTargets.delete(id);
      orphanedPhysicalTargets.delete(id);
      if (stalePhysicalContacts.size === 0) clearLifecycleRecoveryTimer();
      updateContacts(previousCount);
      return wasOrphaned;
    };

    const onPointerDown = (event: PointerEvent) => {
      const active = isScreenCleaningActive();
      addContact(`pointer:${event.pointerId}`, event.target);
      if (active) consume(event);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (isScreenCleaningActive() || orphanedPhysicalContacts.has(`pointer:${event.pointerId}`)) consume(event);
    };
    const onPointerUp = (event: PointerEvent) => {
      const active = isScreenCleaningActive();
      const wasOrphaned = removeContact(`pointer:${event.pointerId}`);
      if (active || wasOrphaned) consume(event);
    };
    const onPointerCancel = (event: PointerEvent) => {
      const active = isScreenCleaningActive();
      const wasOrphaned = removeContact(`pointer:${event.pointerId}`);
      if (active || wasOrphaned) consume(event);
    };
    const onLostPointerCapture = (event: Event) => {
      // Losing capture does not mean the physical contact ended. Keep it until
      // pointerup/cancel, or a blur/visibility recovery proves it is stale.
      if (isScreenCleaningActive()) consume(event);
    };

    const mouseContactId = (button: number) => `mouse:${button}`;
    const onMouseDown = (event: MouseEvent) => {
      const active = isScreenCleaningActive();
      addContact(mouseContactId(event.button), event.target);
      if (active) consume(event);
    };
    const onMouseMove = (event: MouseEvent) => {
      const heldButtonMasks = [1, 4, 2, 8, 16];
      const hasOrphanedHeldButton = heldButtonMasks.some((mask, button) =>
        (event.buttons & mask) !== 0 && orphanedPhysicalContacts.has(mouseContactId(button))
      );
      if (isScreenCleaningActive() || hasOrphanedHeldButton) {
        consume(event);
      }
    };
    const onMouseUp = (event: MouseEvent) => {
      const active = isScreenCleaningActive();
      const wasOrphaned = removeContact(mouseContactId(event.button));
      if (active || wasOrphaned) consume(event);
    };

    const onTouchStart = (event: TouchEvent) => {
      const active = isScreenCleaningActive();
      for (const touch of Array.from(event.changedTouches)) addContact(`touch:${touch.identifier}`, event.target);
      if (active) consume(event);
    };
    const onTouchMove = (event: TouchEvent) => {
      const hasOrphanedTouch = Array.from(event.changedTouches).some(touch =>
        orphanedPhysicalContacts.has(`touch:${touch.identifier}`)
      );
      if (isScreenCleaningActive() || hasOrphanedTouch) consume(event);
    };
    const onTouchEnd = (event: TouchEvent) => {
      const active = isScreenCleaningActive();
      let wasOrphaned = false;
      for (const touch of Array.from(event.changedTouches)) {
        wasOrphaned = removeContact(`touch:${touch.identifier}`) || wasOrphaned;
      }
      if (active || wasOrphaned) consume(event);
    };
    const onTouchCancel = (event: TouchEvent) => {
      const active = isScreenCleaningActive();
      let wasOrphaned = false;
      for (const touch of Array.from(event.changedTouches)) {
        wasOrphaned = removeContact(`touch:${touch.identifier}`) || wasOrphaned;
      }
      if (active || wasOrphaned) consume(event);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const active = isScreenCleaningActive();
      const contactId = `key:${event.code || event.key}`;
      // A keyup can be lost when focus leaves the page. Keep swallowing that
      // key's repeats and eventual keyup, even if the shield has since ended.
      if (orphanedKeys.has(contactId) && event.repeat) {
        consume(event);
        return;
      }
      // A non-repeat keydown is a new physical press. Replace the stale
      // orphan so Escape (or another key) works on its first press after focus
      // returns, while the eventual keyup is still handled normally.
      orphanedKeys.delete(contactId);
      const isFirstDown = !contacts.has(contactId);
      addContact(contactId);
      if (active && event.key === 'Escape' && isFirstDown) {
        requestScreenCleaningExit();
      }
      if (active) consume(event);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const active = isScreenCleaningActive();
      const contactId = `key:${event.code || event.key}`;
      const wasOrphaned = orphanedKeys.delete(contactId);
      removeContact(contactId);
      if (active || wasOrphaned) consume(event);
    };

    const onAnyInput = (event: Event) => {
      if (isScreenCleaningActive()) consume(event);
    };
    const onClick = (event: Event) => {
      const pointerId = (event as PointerEvent).pointerId;
      const clickContactId = typeof pointerId === 'number'
        ? `pointer:${pointerId}`
        : event instanceof MouseEvent && event.detail > 0
          ? mouseContactId(event.button)
          : null;
      if (isScreenCleaningActive()) {
        consume(event);
      } else if (clickContactId && pendingTrailingClickIds.delete(clickContactId)) {
        consume(event);
      }
    };
    const isRelatedOrphanedTarget = (event: Event) => {
      const eventTarget = event.target;
      if (!(eventTarget instanceof Node)) return false;
      return Array.from(orphanedPhysicalTargets.values()).some(source => {
        if (!(source instanceof Node)) return source === eventTarget;
        return source === eventTarget || source.contains(eventTarget) || eventTarget.contains(source);
      });
    };
    const onDragStart = (event: Event) => {
      if (isScreenCleaningActive() || isRelatedOrphanedTarget(event)) consume(event);
    };
    const onContextMenu = (event: MouseEvent) => {
      const pointerId = (event as PointerEvent).pointerId;
      const hasOrphanedPointer = typeof pointerId === 'number' && orphanedPhysicalContacts.has(`pointer:${pointerId}`);
      const hasRelatedOrphanedTouch =
        Array.from(orphanedPhysicalContacts).some(contactId => contactId.startsWith('touch:')) &&
        isRelatedOrphanedTarget(event);
      if (
        isScreenCleaningActive() ||
        orphanedPhysicalContacts.has(mouseContactId(event.button)) ||
        hasOrphanedPointer ||
        hasRelatedOrphanedTouch
      ) consume(event);
    };
    const onAuxClick = (event: MouseEvent) => {
      const pointerId = (event as PointerEvent).pointerId;
      const contactId = typeof pointerId === 'number' ? `pointer:${pointerId}` : mouseContactId(event.button);
      if (isScreenCleaningActive() || orphanedPhysicalContacts.has(contactId)) consume(event);
    };

    const releaseKeyboardContacts = () => {
      const cleaningIsActive = isScreenCleaningActive();
      const previousCount = contacts.size;
      for (const contactId of contacts) {
        if (!contactId.startsWith('key:')) continue;
        contacts.delete(contactId);
        // Only swallow a later keyup when this key was part of a protected
        // cleaning session. Ordinary focus changes must not consume the next
        // legitimate press after the browser drops keyup.
        if (cleaningIsActive) orphanedKeys.add(contactId);
      }
      updateContacts(previousCount);
    };

    const markPhysicalContactsStale = () => {
      if (!isScreenCleaningActive()) return;
      for (const contactId of contacts) {
        if (contactId.startsWith('pointer:') || contactId.startsWith('mouse:') || contactId.startsWith('touch:')) {
          stalePhysicalContacts.add(contactId);
        }
      }
    };

    const recoverStalePhysicalContacts = () => {
      if (document.visibilityState === 'hidden') return;
      if (stalePhysicalContacts.size === 0) return;
      clearLifecycleRecoveryTimer();
      lifecycleRecoveryTimerRef.current = setTimeout(() => {
        lifecycleRecoveryTimerRef.current = null;
        const previousCount = contacts.size;
        for (const contactId of stalePhysicalContacts) {
          contacts.delete(contactId);
          orphanedPhysicalContacts.add(contactId);
          const target = contactTargets.get(contactId);
          if (target) orphanedPhysicalTargets.set(contactId, target);
          contactTargets.delete(contactId);
          pendingTrailingClickIds.add(contactId);
        }
        stalePhysicalContacts.clear();
        updateContacts(previousCount);
      }, LIFECYCLE_RECOVERY_MS);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Browsers can omit terminal events as a page leaves. Keep protection
        // through suspension, then recover contacts that remain stale after
        // the page is visible again.
        markPhysicalContactsStale();
        releaseKeyboardContacts();
      } else {
        recoverStalePhysicalContacts();
      }
    };
    const onWindowBlur = () => {
      markPhysicalContactsStale();
      releaseKeyboardContacts();
    };

    const pointerEvents: Array<[string, EventListener]> = [
      ['pointerdown', onPointerDown as EventListener],
      ['pointermove', onPointerMove as EventListener],
      ['pointerup', onPointerUp as EventListener],
      ['pointercancel', onPointerCancel as EventListener],
      ['lostpointercapture', onLostPointerCapture],
      ['mousedown', onMouseDown as EventListener],
      ['mousemove', onMouseMove as EventListener],
      ['mouseup', onMouseUp as EventListener],
      ['touchstart', onTouchStart as EventListener],
      ['touchmove', onTouchMove as EventListener],
      ['touchend', onTouchEnd as EventListener],
      ['touchcancel', onTouchCancel as EventListener],
      ['click', onClick],
      ['auxclick', onAuxClick as EventListener],
      ['dblclick', onAnyInput],
      ['contextmenu', onContextMenu as EventListener],
      ['wheel', onAnyInput],
      ['dragstart', onDragStart],
      ['dragover', onAnyInput],
      ['drop', onAnyInput],
      ['submit', onAnyInput],
      ['beforeinput', onAnyInput],
      ['input', onAnyInput],
      ['change', onAnyInput],
      ['focusout', onAnyInput],
      ['keydown', onKeyDown as EventListener],
      ['keyup', onKeyUp as EventListener],
      ['keypress', onAnyInput],
    ];

    for (const [type, listener] of pointerEvents) {
      window.addEventListener(type, listener, { capture: true, passive: false });
    }
    window.addEventListener('blur', onWindowBlur, true);
    window.addEventListener('focus', recoverStalePhysicalContacts, true);
    window.addEventListener('pagehide', onWindowBlur, true);
    window.addEventListener('pageshow', recoverStalePhysicalContacts, true);
    document.addEventListener('visibilitychange', onVisibilityChange, true);

    return () => {
      for (const [type, listener] of pointerEvents) {
        window.removeEventListener(type, listener, true);
      }
      window.removeEventListener('blur', onWindowBlur, true);
      window.removeEventListener('focus', recoverStalePhysicalContacts, true);
      window.removeEventListener('pagehide', onWindowBlur, true);
      window.removeEventListener('pageshow', recoverStalePhysicalContacts, true);
      document.removeEventListener('visibilitychange', onVisibilityChange, true);
      clearFinishTimer();
      clearLifecycleRecoveryTimer();
      contacts.clear();
      orphanedKeys.clear();
      stalePhysicalContacts.clear();
      orphanedPhysicalContacts.clear();
      pendingTrailingClickIds.clear();
      contactTargets.clear();
      orphanedPhysicalTargets.clear();
    };
    // Listeners read the controller synchronously; status only matters for
    // scheduling the finish grace after a release or lifecycle event.
  }, []);

  useLayoutEffect(() => {
    // Deadline expiry completes immediately when no contact is down. Early
    // Escape is itself tracked and therefore waits for keyup plus grace.
    if (status !== 'finishing' || contactsRef.current.size > 0 || finishTimerRef.current !== null) return;

    const releasedAt = lastContactReleaseAtRef.current;
    const elapsedSinceRelease = releasedAt === null ? FINISH_GRACE_MS : Math.max(0, Date.now() - releasedAt);
    const graceRemaining = FINISH_GRACE_MS - elapsedSinceRelease;
    if (graceRemaining > 0) {
      const snapshot = getScreenCleaningSnapshot();
      if (snapshot.status !== 'finishing') return;
      const timer = setTimeout(() => {
        finishTimerRef.current = null;
        if (contactsRef.current.size === 0) finishScreenCleaning();
      }, graceRemaining);
      finishTimerRef.current = timer;
    } else {
      finishScreenCleaning();
    }
  }, [status]);

  return physicalContactCount;
}
