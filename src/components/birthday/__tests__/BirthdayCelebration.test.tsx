/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';
import { BIRTHDAY_PARTY_EVENT, BIRTHDAY_WELCOME_DELAY_MS } from '@/lib/birthdayCelebration';

const mockInstance = Object.assign(
  jest.fn(() => Promise.resolve()),
  { reset: jest.fn() }
);
const mockCreate = jest.fn(() => mockInstance);

const birthday = {
  name: 'Sample Person',
  birthDate: '2014-02-15',
  eventType: 'birthday' as const,
  partyModeEnabled: true,
  userId: 'sample-person',
};

const anniversary = {
  name: 'Example Couple',
  birthDate: '2010-02-15',
  eventType: 'anniversary' as const,
  partyModeEnabled: true,
  userId: 'example-couple',
};

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

jest.mock('canvas-confetti', () => ({
  __esModule: true,
  default: { create: mockCreate },
}));

import {
  BirthdayCelebration,
  cancelBirthdayParty,
  triggerBirthdayParty,
} from '../BirthdayCelebration';

describe('BirthdayCelebration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-15T09:30:00'));
    reducedMotionPreference = false;
    mediaQueryListeners = new Set();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => mediaQuery),
    });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    mockCreate.mockClear();
    mockInstance.mockClear();
    mockInstance.reset.mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('welcomes a family birthday automatically', () => {
    const { container } = render(
      <BirthdayCelebration celebrations={[birthday]} random={() => 0} />
    );

    act(() => jest.advanceTimersByTime(BIRTHDAY_WELCOME_DELAY_MS));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(5);
    expect(container.firstElementChild?.getAttribute('data-birthday-recipe')).toBe(
      'Big Birthday Moment'
    );
  });

  it('welcomes a family anniversary and ignores milestones', () => {
    const { container, rerender } = render(
      <BirthdayCelebration celebrations={[anniversary]} random={() => 0} />
    );
    act(() => jest.advanceTimersByTime(BIRTHDAY_WELCOME_DELAY_MS));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(5);

    rerender(
      <BirthdayCelebration
        celebrations={[{ ...birthday, eventType: 'milestone' }]}
        random={() => 0}
      />
    );
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
  });

  it('supports the universal manual trigger and cancel bridge', () => {
    const { container } = render(
      <BirthdayCelebration celebrations={[birthday]} random={() => 0} />
    );

    act(() => triggerBirthdayParty({ intensity: 'party' }));
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(3);
    act(() => jest.advanceTimersByTime(420));
    expect(mockInstance).toHaveBeenCalled();

    act(() => cancelBirthdayParty());
    expect(container.querySelectorAll('svg.birthday-balloon')).toHaveLength(0);
  });

  it('ignores the trigger on a date without a family celebration', () => {
    const { container } = render(
      <BirthdayCelebration
        celebrations={[{ ...birthday, birthDate: '2014-02-16' }]}
        random={() => 0}
      />
    );
    act(() =>
      window.dispatchEvent(
        new CustomEvent(BIRTHDAY_PARTY_EVENT, { detail: { intensity: 'party' } })
      )
    );
    expect(container.firstElementChild).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('ignores unmarked birthdays', () => {
    const { container } = render(
      <BirthdayCelebration
        celebrations={[{ ...birthday, partyModeEnabled: false }]}
        random={() => 0}
      />
    );

    act(() => jest.advanceTimersByTime(BIRTHDAY_WELCOME_DELAY_MS));
    expect(container.firstElementChild).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
