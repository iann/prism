/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';
import {
  CAMERON_BIRTHDAY_PARTY_EVENT,
  CAMERON_BIRTHDAY_MAX_SCENE_DELAY_MS,
  CAMERON_BIRTHDAY_MIN_SCENE_DELAY_MS,
  CAMERON_BIRTHDAY_WELCOME_DELAY_MS,
  selectCameronBirthdaySceneDelay,
} from '@/lib/cameronBirthday';

const mockInstance = Object.assign(
  jest.fn(() => Promise.resolve()),
  { reset: jest.fn() }
);
const mockCreate = jest.fn(() => mockInstance);

let reducedMotionPreference = false;
let mediaQueryListeners = new Set<(event: MediaQueryListEvent) => void>();
const mediaQuery = {
  get matches() {
    return reducedMotionPreference;
  },
  media: '(prefers-reduced-motion: reduce)',
  addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
    mediaQueryListeners.add(listener);
  },
  removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
    mediaQueryListeners.delete(listener);
  },
} as unknown as MediaQueryList;

function setReducedMotionPreference(matches: boolean) {
  reducedMotionPreference = matches;
  const event = { matches, media: '(prefers-reduced-motion: reduce)' } as MediaQueryListEvent;
  mediaQueryListeners.forEach((listener) => listener(event));
}

jest.mock('canvas-confetti', () => ({
  __esModule: true,
  default: { create: mockCreate },
}));

import {
  BirthdayCelebration,
  cancelCameronBirthdayParty,
  triggerCameronBirthdayParty,
} from '../BirthdayCelebration';
import { BIG_BIRTHDAY_MOMENT, CONFETTI_CANNONS } from '../birthdayCelebrationRecipes';

describe('BirthdayCelebration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-12T09:30:00Z'));
    reducedMotionPreference = false;
    mediaQueryListeners = new Set();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => mediaQuery),
    });
    localStorage.clear();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    mockCreate.mockClear();
    mockInstance.mockClear();
    mockInstance.reset.mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  it('starts a deterministic welcome scene after one second on Cameron’s birthday', () => {
    const { container } = render(<BirthdayCelebration random={() => 0} />);

    act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_WELCOME_DELAY_MS - 1));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
    act(() => jest.advanceTimersByTime(1));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(5);
    expect(container.firstElementChild?.getAttribute('data-birthday-recipe')).toBe(
      BIG_BIRTHDAY_MOMENT.name
    );

    act(() => jest.advanceTimersByTime(420));
    const calls = mockInstance.mock.calls as unknown as Array<[{ particleCount?: number }]>;
    expect(calls.reduce((sum, [options]) => sum + (options?.particleCount ?? 0), 0)).toBe(50);
  });

  it('rechecks the local date before a delayed welcome scene starts', () => {
    const { container } = render(<BirthdayCelebration random={() => 0} />);

    jest.setSystemTime(new Date('2026-09-13T12:01:00Z'));
    act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_WELCOME_DELAY_MS));

    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
  });

  it('rechecks the local date before a recurring scene starts', () => {
    const { container } = render(<BirthdayCelebration random={() => 0} />);

    act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_WELCOME_DELAY_MS + 4_400));
    jest.setSystemTime(new Date('2026-09-13T12:01:00Z'));
    act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_MIN_SCENE_DELAY_MS));

    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
  });

  it('recurs after an independently selected three-to-five minute delay', () => {
    const random = jest.fn(() => 0);
    const { container } = render(<BirthdayCelebration random={random} />);

    act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_WELCOME_DELAY_MS));
    act(() => jest.advanceTimersByTime(4_400));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);

    act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_MIN_SCENE_DELAY_MS - 1));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
    act(() => jest.advanceTimersByTime(1));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(1);
  });

  it('keeps scene delay selection within inclusive three-to-five minute bounds', () => {
    expect(CAMERON_BIRTHDAY_MIN_SCENE_DELAY_MS).toBe(3 * 60_000);
    expect(CAMERON_BIRTHDAY_MAX_SCENE_DELAY_MS).toBe(5 * 60_000);
    expect(selectCameronBirthdaySceneDelay(() => 0)).toBe(CAMERON_BIRTHDAY_MIN_SCENE_DELAY_MS);
    expect(selectCameronBirthdaySceneDelay(() => 1)).toBe(CAMERON_BIRTHDAY_MAX_SCENE_DELAY_MS);
    expect(selectCameronBirthdaySceneDelay(() => 0.5)).toBe(
      (CAMERON_BIRTHDAY_MIN_SCENE_DELAY_MS + CAMERON_BIRTHDAY_MAX_SCENE_DELAY_MS) / 2
    );
  });

  it('creates one worker-backed canvas instance and renders a manual party', () => {
    const onComplete = jest.fn();
    const { container } = render(<BirthdayCelebration random={() => 0} onComplete={onComplete} />);

    expect(mockCreate).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), {
      resize: true,
      useWorker: true,
      disableForReducedMotion: true,
    });
    expect(container.querySelectorAll('canvas')).toHaveLength(1);
    expect(container.firstElementChild?.className).toContain('z-[80]');

    act(() => triggerCameronBirthdayParty({ intensity: 'party' }));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(3);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');

    act(() => jest.advanceTimersByTime(420));
    expect(mockInstance).toHaveBeenCalled();
    const calls = mockInstance.mock.calls as unknown as Array<[{ particleCount?: number }]>;
    expect(calls.reduce((sum, [options]) => sum + (options?.particleCount ?? 0), 0)).toBe(30);
  });

  it('fires Confetti Cannons from both edges toward the center', () => {
    render(<BirthdayCelebration random={() => 0} />);

    act(() => triggerCameronBirthdayParty({ intensity: 'party' }));
    act(() => jest.advanceTimersByTime(420));

    expect(mockInstance).toHaveBeenCalledTimes(2);
    const calls = mockInstance.mock.calls as unknown as Array<
      [{ angle?: number; origin?: { x?: number; y?: number }; particleCount?: number }]
    >;
    expect(calls[0]?.[0]).toMatchObject({
      angle: 45,
      origin: { x: 0 },
      particleCount: 15,
      colors: CONFETTI_CANNONS.colors,
    });
    expect(calls[1]?.[0]).toMatchObject({
      angle: 135,
      origin: { x: 1 },
      particleCount: 15,
      colors: CONFETTI_CANNONS.colors,
    });
  });

  it('uses the selected recipe palette for balloons and keeps the hero variant stable', () => {
    const { container } = render(<BirthdayCelebration random={() => 0} />);

    act(() => triggerCameronBirthdayParty({ intensity: 'supernova' }));
    const hero = container.querySelector('svg.birthday-balloon--hero');
    expect(container.firstElementChild?.getAttribute('data-birthday-recipe')).toBe(
      BIG_BIRTHDAY_MOMENT.name
    );
    expect(hero?.getAttribute('data-birthday-hero-variant')).toBe('smiling');
    expect(hero?.getAttribute('style')).toContain('--birthday-balloon-color: #ff006e');

    act(() => jest.advanceTimersByTime(1));
    expect(container.querySelector('svg.birthday-balloon--hero')?.getAttribute('style')).toContain(
      '--birthday-balloon-color: #ff006e'
    );
  });

  it('ignores overlapping requests and resets the instance during cleanup', () => {
    const { unmount } = render(<BirthdayCelebration random={() => 0} />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(CAMERON_BIRTHDAY_PARTY_EVENT, { detail: { intensity: 'supernova' } })
      );
      window.dispatchEvent(
        new CustomEvent(CAMERON_BIRTHDAY_PARTY_EVENT, { detail: { intensity: 'party' } })
      );
    });
    expect(document.querySelectorAll('svg.birthday-balloon')).toHaveLength(5);

    unmount();
    expect(mockInstance.reset).toHaveBeenCalled();
  });

  it('ignores triggers while inactive and cancels the active scene on date rollover', () => {
    const { container } = render(<BirthdayCelebration random={() => 0} />);
    act(() => triggerCameronBirthdayParty({ intensity: 'party' }));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(3);

    jest.setSystemTime(new Date('2026-09-13T12:01:00Z'));
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
    act(() => triggerCameronBirthdayParty({ intensity: 'party' }));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
    act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_MAX_SCENE_DELAY_MS));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
  });

  it('does not activate on an adjacent local calendar date', () => {
    jest.setSystemTime(new Date('2026-09-11T23:30:00Z'));
    const { container } = render(<BirthdayCelebration random={() => 0} />);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(container.firstElementChild).toBeNull();
    expect(container.querySelectorAll('canvas')).toHaveLength(0);
    act(() => triggerCameronBirthdayParty({ intensity: 'party' }));
    act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_MAX_SCENE_DELAY_MS));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
  });

  it('cancels pending and active work while hidden without queueing missed scenes', () => {
    const { container } = render(<BirthdayCelebration random={() => 0} />);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_MAX_SCENE_DELAY_MS));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_WELCOME_DELAY_MS));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
    act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_MIN_SCENE_DELAY_MS));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(1);
  });

  it('supports the explicit cancel bridge and ignores hidden triggers', () => {
    const { container } = render(<BirthdayCelebration random={() => 0} />);
    act(() => triggerCameronBirthdayParty({ intensity: 'party' }));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(3);

    act(() => cancelCameronBirthdayParty());
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => triggerCameronBirthdayParty({ intensity: 'party' }));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
  });

  it.each([
    ['welcome', CAMERON_BIRTHDAY_WELCOME_DELAY_MS],
    ['recurring', CAMERON_BIRTHDAY_MIN_SCENE_DELAY_MS],
  ])('clears a pending %s timer through the explicit cancel bridge', (_label, delay) => {
    const { container } = render(<BirthdayCelebration random={() => 0} />);

    if (_label === 'recurring') {
      act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_WELCOME_DELAY_MS + 4_400));
    }
    act(() => cancelCameronBirthdayParty());
    act(() => jest.advanceTimersByTime(delay + 1));

    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
  });

  it('finishes the three-act scene within the defensive maximum', () => {
    const onComplete = jest.fn();
    render(<BirthdayCelebration random={() => 0} onComplete={onComplete} />);

    act(() => triggerCameronBirthdayParty({ intensity: 'supernova' }));
    act(() => jest.advanceTimersByTime(4_400));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
    expect(mockInstance.reset).toHaveBeenCalled();
  });

  it('suppresses celebration instances, balloons, and scene timers for reduced motion', () => {
    setReducedMotionPreference(true);
    const { container } = render(<BirthdayCelebration random={() => 0} />);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(container.firstElementChild).toBeNull();
    expect(container.querySelectorAll('canvas')).toHaveLength(0);
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(1);

    act(() => triggerCameronBirthdayParty({ intensity: 'supernova' }));
    act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_MAX_SCENE_DELAY_MS));

    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
    expect(mockInstance).not.toHaveBeenCalled();
  });

  it('immediately resets and cancels an active scene when reduced motion turns on', () => {
    const { container } = render(<BirthdayCelebration random={() => 0} />);

    act(() => triggerCameronBirthdayParty({ intensity: 'party' }));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(3);

    act(() => setReducedMotionPreference(true));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
    expect(mockInstance.reset).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);

    act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_MAX_SCENE_DELAY_MS));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
  });

  it('allows a fresh welcome scene after reduced motion turns off while visible', () => {
    setReducedMotionPreference(true);
    const { container } = render(<BirthdayCelebration random={() => 0} />);

    act(() => setReducedMotionPreference(false));
    act(() => jest.advanceTimersByTime(CAMERON_BIRTHDAY_WELCOME_DELAY_MS));

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(5);
  });

  it('does not let Prism Performance Mode suppress the birthday celebration', () => {
    localStorage.setItem('prism-perf-mode', 'true');
    window.dispatchEvent(new Event('prism:performance-mode-change'));
    const { container } = render(<BirthdayCelebration random={() => 0} />);

    act(() => triggerCameronBirthdayParty({ intensity: 'party' }));

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(3);
  });
});
