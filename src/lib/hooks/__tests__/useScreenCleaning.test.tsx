/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

jest.mock('../useIsPWA', () => ({ useIsPWA: () => false }));

import { useIdleDetection } from '../useIdleDetection';
import {
  finishScreenCleaning,
  getScreenCleaningSnapshot,
  resetScreenCleaning,
  requestScreenCleaningExit,
  startScreenCleaning,
  useScreenCleaning,
} from '../useScreenCleaning';
import { useScreenCleaningInputGuard } from '../useScreenCleaningInputGuard';

let originalFetch: typeof fetch;

function useCleaningGuard() {
  const { status } = useScreenCleaning();
  const physicalContactCount = useScreenCleaningInputGuard(status);
  return { status, physicalContactCount };
}

beforeEach(() => {
  originalFetch = global.fetch;
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-30T12:00:00.000Z'));
  window.localStorage.clear();
  resetScreenCleaning();
});

afterEach(() => {
  resetScreenCleaning();
  global.fetch = originalFetch;
  jest.useRealTimers();
});

describe('screen cleaning controller and input guard', () => {
  it('keeps a single 60-second deadline when started more than once', () => {
    const { result } = renderHook(() => useScreenCleaning());
    const startTime = Date.now();

    act(() => startScreenCleaning());
    const deadline = result.current.deadline;
    expect(deadline).toBe(startTime + 60_000);

    act(() => {
      jest.advanceTimersByTime(10_000);
      startScreenCleaning();
    });

    expect(result.current.deadline).toBe(deadline);
    expect(result.current.remainingSeconds).toBe(50);

    act(() => jest.advanceTimersByTime(50_000));
    expect(result.current.status).toBe('finishing');
  });

  it('reconciles the deadline when a suspended tab becomes visible again', () => {
    const { result } = renderHook(() => useScreenCleaning());
    act(() => startScreenCleaning());

    act(() => {
      jest.setSystemTime(Date.now() + 61_000);
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.status).toBe('finishing');
  });

  it('keeps the shield through a held wipe and blocks its release and click', () => {
    const { result } = renderHook(() => useCleaningGuard());
    const button = document.createElement('button');
    document.body.appendChild(button);
    const received: string[] = [];
    button.addEventListener('mousedown', () => received.push('down'));
    button.addEventListener('mouseup', () => received.push('up'));
    button.addEventListener('click', () => received.push('click'));

    // Track a contact already in progress before the user starts cleaning.
    act(() => button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
    act(() => startScreenCleaning());
    act(() => window.dispatchEvent(new Event('blur')));
    expect(result.current.physicalContactCount).toBe(1);
    act(() => jest.advanceTimersByTime(60_000));

    expect(result.current.status).toBe('finishing');
    expect(result.current.physicalContactCount).toBe(1);

    const release = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
    const trailingClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    act(() => {
      button.dispatchEvent(release);
      button.dispatchEvent(trailingClick);
    });

    expect(release.defaultPrevented).toBe(true);
    expect(trailingClick.defaultPrevented).toBe(true);
    expect(received).toEqual(['down']);

    act(() => jest.advanceTimersByTime(699));
    expect(getScreenCleaningSnapshot().status).toBe('finishing');
    act(() => jest.advanceTimersByTime(1));
    expect(getScreenCleaningSnapshot().status).toBe('inactive');
    button.remove();
  });

  it('recovers a physical contact if the browser loses its terminal event while hidden', () => {
    const { result } = renderHook(() => useCleaningGuard());
    const button = document.createElement('button');
    document.body.appendChild(button);
    let receivedEvents = 0;
    button.addEventListener('mouseup', () => receivedEvents++);
    button.addEventListener('click', () => receivedEvents++);
    button.addEventListener('mousemove', () => receivedEvents++);
    button.addEventListener('dragstart', () => receivedEvents++);
    const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');

    act(() => startScreenCleaning());
    act(() => button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
    act(() => button.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true, cancelable: true })));
    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(() => jest.advanceTimersByTime(999));
    expect(result.current.physicalContactCount).toBe(2);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.physicalContactCount).toBe(0);
    act(() => jest.advanceTimersByTime(59_000));
    expect(result.current.status).toBe('inactive');

    const movement = new MouseEvent('mousemove', { bubbles: true, cancelable: true, buttons: 1 });
    const drag = new Event('dragstart', { bubbles: true, cancelable: true });
    const rightMovement = new MouseEvent('mousemove', { bubbles: true, cancelable: true, buttons: 2 });
    const contextMenu = new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true });
    act(() => {
      button.dispatchEvent(movement);
      button.dispatchEvent(rightMovement);
      button.dispatchEvent(contextMenu);
      button.dispatchEvent(drag);
    });
    expect(movement.defaultPrevented).toBe(true);
    expect(rightMovement.defaultPrevented).toBe(true);
    expect(contextMenu.defaultPrevented).toBe(true);
    expect(drag.defaultPrevented).toBe(true);
    expect(receivedEvents).toBe(0);

    const unrelatedTarget = document.createElement('div');
    document.body.appendChild(unrelatedTarget);
    const unrelatedDrag = new Event('dragstart', { bubbles: true, cancelable: true });
    act(() => unrelatedTarget.dispatchEvent(unrelatedDrag));
    expect(unrelatedDrag.defaultPrevented).toBe(false);

    // The hidden contact is no longer blocking the countdown, but a late
    // terminal event and its compatibility click remain quarantined.
    const release = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
    const trailingClick = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    act(() => {
      button.dispatchEvent(release);
      button.dispatchEvent(trailingClick);
    });
    expect(release.defaultPrevented).toBe(true);
    expect(trailingClick.defaultPrevented).toBe(true);
    expect(receivedEvents).toBe(0);

    // An unrelated fresh click is not swallowed by a global time window.
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
    expect(receivedEvents).toBe(1);

    if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
    unrelatedTarget.remove();
    button.remove();
  });

  it('quarantines late pen and touch context menus without blocking unrelated targets', () => {
    renderHook(() => useCleaningGuard());
    const target = document.createElement('button');
    const unrelatedTarget = document.createElement('button');
    document.body.append(target, unrelatedTarget);
    const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');

    const penDown = new Event('pointerdown', { bubbles: true, cancelable: true });
    Object.defineProperties(penDown, {
      pointerId: { configurable: true, value: 31 },
      pointerType: { configurable: true, value: 'pen' },
    });
    const touchStart = new Event('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(touchStart, 'changedTouches', {
      configurable: true,
      value: [{ identifier: 7 }],
    });

    act(() => startScreenCleaning());
    act(() => {
      target.dispatchEvent(penDown);
      target.dispatchEvent(touchStart);
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(() => jest.advanceTimersByTime(1_000));
    act(() => jest.advanceTimersByTime(59_700));
    expect(getScreenCleaningSnapshot().status).toBe('inactive');

    const penContextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    Object.defineProperties(penContextMenu, {
      pointerId: { configurable: true, value: 31 },
      pointerType: { configurable: true, value: 'pen' },
    });
    const touchContextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const unrelatedContextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => {
      target.dispatchEvent(penContextMenu);
      target.dispatchEvent(touchContextMenu);
      unrelatedTarget.dispatchEvent(unrelatedContextMenu);
    });

    expect(penContextMenu.defaultPrevented).toBe(true);
    expect(touchContextMenu.defaultPrevented).toBe(true);
    expect(unrelatedContextMenu.defaultPrevented).toBe(false);

    if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
    unrelatedTarget.remove();
    target.remove();
  });

  it('does not restart the finishing grace when a stale contact releases before recovery', () => {
    const { result } = renderHook(() => useCleaningGuard());
    const button = document.createElement('button');
    document.body.appendChild(button);
    const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');

    act(() => startScreenCleaning());
    act(() => button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(() => requestScreenCleaningExit());
    act(() => jest.advanceTimersByTime(500));

    const release = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
    act(() => button.dispatchEvent(release));
    expect(release.defaultPrevented).toBe(true);
    expect(result.current.status).toBe('finishing');
    act(() => jest.advanceTimersByTime(700));
    expect(result.current.status).toBe('inactive');

    if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
    button.remove();
  });

  it('uses Escape for a guarded early exit without exposing the key to the page', () => {
    const { result } = renderHook(() => useCleaningGuard());
    const input = document.createElement('input');
    document.body.appendChild(input);
    let keyEventsReachedInput = 0;
    input.addEventListener('keydown', () => keyEventsReachedInput++);
    input.addEventListener('keyup', () => keyEventsReachedInput++);

    act(() => startScreenCleaning());
    const escapeDown = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
    act(() => input.dispatchEvent(escapeDown));

    expect(escapeDown.defaultPrevented).toBe(true);
    expect(result.current.status).toBe('finishing');
    expect(result.current.physicalContactCount).toBe(0);
    expect(keyEventsReachedInput).toBe(0);

    const escapeUp = new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
    act(() => input.dispatchEvent(escapeUp));
    expect(escapeUp.defaultPrevented).toBe(true);
    expect(keyEventsReachedInput).toBe(0);

    act(() => jest.advanceTimersByTime(700));
    expect(getScreenCleaningSnapshot().status).toBe('inactive');
    input.remove();
  });

  it('does not swallow ordinary key presses after focus is lost while cleaning is inactive', () => {
    renderHook(() => useCleaningGuard());
    const input = document.createElement('input');
    document.body.appendChild(input);
    let keyEventsReachedInput = 0;
    input.addEventListener('keydown', () => keyEventsReachedInput++);
    input.addEventListener('keyup', () => keyEventsReachedInput++);

    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true, cancelable: true })));
    act(() => window.dispatchEvent(new Event('blur')));
    const nextDown = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true, cancelable: true });
    const nextUp = new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true, cancelable: true });
    act(() => {
      input.dispatchEvent(nextDown);
      input.dispatchEvent(nextUp);
    });

    expect(nextDown.defaultPrevented).toBe(false);
    expect(nextUp.defaultPrevented).toBe(false);
    expect(keyEventsReachedInput).toBe(3);
    input.remove();
  });

  it('accepts a fresh Escape press after its earlier keyup was lost during cleaning', () => {
    const { result } = renderHook(() => useCleaningGuard());
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => startScreenCleaning());
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })));
    act(() => window.dispatchEvent(new Event('blur')));

    const nextEscape = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
    act(() => input.dispatchEvent(nextEscape));

    expect(nextEscape.defaultPrevented).toBe(true);
    expect(result.current.status).toBe('finishing');
    input.remove();
  });
});

describe('screen cleaning idle coordination', () => {
  it('pauses the screensaver countdown and resumes it fresh after cleaning', () => {
    const { result } = renderHook(() => useIdleDetection(5));

    act(() => jest.advanceTimersByTime(4_000));
    act(() => startScreenCleaning());
    act(() => jest.advanceTimersByTime(60_000));
    expect(result.current.isIdle).toBe(false);

    act(() => finishScreenCleaning());
    act(() => jest.advanceTimersByTime(4_000));
    expect(result.current.isIdle).toBe(false);
    act(() => jest.advanceTimersByTime(1_000));
    expect(result.current.isIdle).toBe(true);
  });

  it('keeps an already-idle display idle through cleaning', () => {
    const { result } = renderHook(() => useIdleDetection(5));
    act(() => result.current.forceIdle());
    expect(result.current.isIdle).toBe(true);

    act(() => startScreenCleaning());
    act(() => finishScreenCleaning());

    expect(result.current.isIdle).toBe(true);
  });

  it('aborts a pending automatic Away check when cleaning starts before its POST', async () => {
    const hour = 60 * 60 * 1000;
    window.localStorage.setItem('prism-away-mode-timeout', '24');
    window.localStorage.setItem('prism-screensaver-timeout', '0');
    window.localStorage.setItem('prism-last-activity', String(Date.now() - 30 * hour));

    let resolveGet!: (response: Response) => void;
    const getPromise = new Promise<Response>(resolve => { resolveGet = resolve; });
    const fetchMock = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBeUndefined();
      return getPromise;
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { unmount } = renderHook(() => useIdleDetection());

    const getSignal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(getSignal?.aborted).toBe(false);

    act(() => startScreenCleaning());
    expect(getSignal?.aborted).toBe(true);

    await act(async () => {
      resolveGet({ ok: true, json: async () => ({ enabled: false }) } as Response);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('publishes the committed Away state when cleaning starts after its auto-activation POST was sent', async () => {
    const hour = 60 * 60 * 1000;
    window.localStorage.setItem('prism-away-mode-timeout', '24');
    window.localStorage.setItem('prism-screensaver-timeout', '0');
    window.localStorage.setItem('prism-last-activity', String(Date.now() - 30 * hour));

    let resolvePost!: (response: Response) => void;
    const postPromise = new Promise<Response>(resolve => { resolvePost = resolve; });
    const fetchMock = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return postPromise;
      }
      return Promise.resolve({ ok: true, json: async () => ({ enabled: false }) } as Response);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    let changeEvents = 0;
    let eventState: { enabled?: boolean } | undefined;
    const onAwayChange = (event: Event) => {
      changeEvents++;
      eventState = (event as CustomEvent<{ enabled?: boolean }>).detail;
    };
    window.addEventListener('prism:away-mode-change', onAwayChange);
    const { unmount } = renderHook(() => useIdleDetection());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true);

    act(() => startScreenCleaning());
    expect(changeEvents).toBe(0);
    expect(window.localStorage.getItem('prism-last-activity')).toBe(String(Date.now()));

    await act(async () => {
      resolvePost({ ok: true, json: async () => ({ enabled: true, enabledBy: 'auto' }) } as Response);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(changeEvents).toBe(1);
    expect(eventState).toBeUndefined();
    unmount();
    window.removeEventListener('prism:away-mode-change', onAwayChange);
  });
});
