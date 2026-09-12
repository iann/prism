import { millisecondsUntilNextClockTick, shouldShowClockGreeting } from '../ClockWidget';
import { getClockGreeting } from '../ClockGreeting';
import { CAMERON_BIRTHDAY_GREETING } from '@/lib/cameronBirthday';

describe('millisecondsUntilNextClockTick', () => {
  it('aligns minute-only clocks to the next minute', () => {
    expect(millisecondsUntilNextClockTick(false, 30_000)).toBe(30_000);
    expect(millisecondsUntilNextClockTick(false, 59_999)).toBe(1);
  });

  it('aligns clocks with seconds to the next second', () => {
    expect(millisecondsUntilNextClockTick(true, 250)).toBe(750);
    expect(millisecondsUntilNextClockTick(true, 999)).toBe(1);
  });

  it('waits a full interval when already on a boundary', () => {
    expect(millisecondsUntilNextClockTick(false, 60_000)).toBe(60_000);
    expect(millisecondsUntilNextClockTick(true, 1_000)).toBe(1_000);
  });
});

describe('Cameron birthday clock greeting', () => {
  it('uses the exact birthday greeting before the normal daily selection', () => {
    expect(getClockGreeting(new Date(2026, 8, 12, 9, 30))).toBe(CAMERON_BIRTHDAY_GREETING);
  });

  it('shows the birthday greeting even when the normal greeting is disabled', () => {
    expect(shouldShowClockGreeting(false, new Date(2026, 8, 12, 9, 30))).toBe(true);
  });

  it('uses the browser-local date at the birthday boundary', () => {
    const justBeforeLocalBirthday = new Date(2026, 8, 11, 23, 59, 59);
    const atLocalBirthday = new Date(2026, 8, 12, 0, 0, 0);

    expect(shouldShowClockGreeting(false, justBeforeLocalBirthday)).toBe(false);
    expect(shouldShowClockGreeting(false, atLocalBirthday)).toBe(true);
    expect(getClockGreeting(atLocalBirthday)).toBe(CAMERON_BIRTHDAY_GREETING);
  });

  it('preserves normal greeting visibility on adjacent dates', () => {
    expect(shouldShowClockGreeting(false, new Date(2026, 8, 11, 9, 30))).toBe(false);
    expect(shouldShowClockGreeting(false, new Date(2026, 8, 13, 9, 30))).toBe(false);
    expect(getClockGreeting(new Date(2026, 8, 11, 9, 30))).not.toBe(CAMERON_BIRTHDAY_GREETING);
  });
});
