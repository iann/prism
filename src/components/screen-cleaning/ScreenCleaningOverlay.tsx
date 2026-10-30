'use client';

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useGlobalInput } from '@/lib/hooks/useGlobalInput';
import { resetScreenCleaning, useScreenCleaning } from '@/lib/hooks/useScreenCleaning';
import { useScreenCleaningInputGuard } from '@/lib/hooks/useScreenCleaningInputGuard';

const TITLE_ID = 'screen-cleaning-title';
const DESCRIPTION_ID = 'screen-cleaning-description';
const ESCAPE_HINT_ID = 'screen-cleaning-escape-hint';
const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function restoreInertValues(values: Map<HTMLElement, boolean>): void {
  for (const element of values.keys()) {
    const original = values.get(element);
    if (original !== undefined) element.inert = original;
  }
  values.clear();
}

function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

/** Persistent root-layout host for the temporary screen-cleaning shield. */
export function ScreenCleaningOverlay() {
  const { status, remainingSeconds } = useScreenCleaning();
  const { setKeyboardVisible, stopListening } = useGlobalInput();
  const active = status !== 'inactive';
  const contactCount = useScreenCleaningInputGuard(status);
  const portalReady = useSyncExternalStore(subscribeToNothing, getClientSnapshot, getServerSnapshot);
  const [announcement, setAnnouncement] = useState('');
  const portalRootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const wasActiveRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const inertValuesRef = useRef(new Map<HTMLElement, boolean>());
  const observerRef = useRef<MutationObserver | null>(null);
  const deactivateRef = useRef<() => void>(() => {});
  const inputApiRef = useRef({ setKeyboardVisible, stopListening });
  const previousStatusRef = useRef(status);

  useLayoutEffect(() => {
    inputApiRef.current = { setKeyboardVisible, stopListening };
  }, [setKeyboardVisible, stopListening]);

  useLayoutEffect(() => {
    deactivateRef.current = () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      restoreInertValues(inertValuesRef.current);
      const wasActive = wasActiveRef.current;
      wasActiveRef.current = false;

      const priorFocus = previousFocusRef.current;
      previousFocusRef.current = null;
      if (wasActive && priorFocus?.isConnected) priorFocus.focus({ preventScroll: true });
      if (wasActive) {
        inputApiRef.current.stopListening();
        inputApiRef.current.setKeyboardVisible(false);
      }
    };

    return () => {
      deactivateRef.current();
      resetScreenCleaning();
    };
  }, []);

  useLayoutEffect(() => {
    const previousStatus = previousStatusRef.current;
    if (previousStatus === 'inactive' && status === 'cleaning') {
      setAnnouncement('Screen cleaning started. Touches are paused for up to one minute. Press Escape to finish early.');
    } else if (previousStatus === 'cleaning' && status === 'finishing') {
      setAnnouncement('Screen cleaning is finishing. Release any contact to return.');
    } else if (previousStatus !== 'inactive' && status === 'inactive') {
      setAnnouncement('Screen cleaning complete.');
    }
    previousStatusRef.current = status;
  }, [status]);

  useLayoutEffect(() => {
    if (!active) {
      deactivateRef.current();
      return;
    }
    if (!portalReady) return;

    const portalRoot = portalRootRef.current;
    const dialog = dialogRef.current;
    if (!portalRoot || !dialog) return;

    if (!wasActiveRef.current) {
      const focused = document.activeElement;
      previousFocusRef.current = focused instanceof HTMLElement && focused !== document.body
        ? focused
        : null;

      const inertSibling = (node: Node) => {
        if (!(node instanceof HTMLElement) || node === portalRoot) return;
        if (!inertValuesRef.current.has(node)) inertValuesRef.current.set(node, node.inert);
        node.inert = true;
      };
      for (const child of Array.from(document.body.children)) inertSibling(child);
      observerRef.current = new MutationObserver(records => {
        for (const record of records) {
          for (const node of Array.from(record.addedNodes)) inertSibling(node);
        }
      });
      observerRef.current.observe(document.body, { childList: true });

      // The modal takes keyboard and speech input away from the page as it
      // moves focus into the shield.
      stopListening();
      setKeyboardVisible(false);
      dialog.focus({ preventScroll: true });
      wasActiveRef.current = true;
    }

    const keepFocusInside = (event: FocusEvent) => {
      if (!wasActiveRef.current) return;
      event.stopImmediatePropagation();
      if (!dialog.contains(event.target as Node)) dialog.focus({ preventScroll: true });
    };
    window.addEventListener('focusin', keepFocusInside, true);

    return () => window.removeEventListener('focusin', keepFocusInside, true);
  }, [active, portalReady, setKeyboardVisible, stopListening]);

  if (!portalReady || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={portalRootRef}
      data-screen-cleaning-portal
      className={active ? 'pointer-events-auto' : 'pointer-events-none'}
    >
      {active && (
        <section
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={TITLE_ID}
          aria-describedby={`${DESCRIPTION_ID} ${ESCAPE_HINT_ID}`}
          aria-keyshortcuts="Escape"
          tabIndex={-1}
          className="fixed inset-0 z-[10002] flex touch-none select-none items-center justify-center overflow-hidden overscroll-none bg-black px-6 text-white outline-none"
          style={{ touchAction: 'none', overscrollBehavior: 'none' }}
        >
          <div className="text-center">
            <h1 id={TITLE_ID} className="text-lg font-medium tracking-wide">Screen cleaning</h1>
            <p id={DESCRIPTION_ID} className="mt-2 text-sm text-white/65">Touches are paused</p>
            {status === 'finishing' ? (
              <p className="mt-5 text-sm text-white/85" aria-live="off">
                {contactCount > 0 ? 'Lift your hand or cloth to finish' : 'Finishing…'}
              </p>
            ) : (
              <p className="mt-5 text-2xl font-light tabular-nums" aria-live="off">
                Returns in {formatRemaining(remainingSeconds)}
              </p>
            )}
            <p id={ESCAPE_HINT_ID} className="mt-5 text-xs text-white/45">Press Esc to finish early</p>
          </div>
        </section>
      )}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>,
    document.body,
  );
}
