import { millisecondsUntilNextClockTick, shouldShowClockGreeting } from '../ClockWidget';
import { getClockGreeting } from '../ClockGreeting';

const familyBirthday = {
  name: 'Emma',
  birthDate: '2014-09-12',
  eventType: 'birthday' as const,
  partyModeEnabled: true,
  userId: 'emma',
};

const familyAnniversary = {
  name: 'Alex & Jordan',
  birthDate: '2010-09-12',
  eventType: 'anniversary' as const,
  partyModeEnabled: true,
  userId: 'alex',
};

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

describe('family celebration clock greeting', () => {
  it('shows a family birthday even when the normal greeting is disabled', () => {
    const date = new Date(2026, 8, 12, 9, 30);
    expect(shouldShowClockGreeting(false, date, [familyBirthday])).toBe(true);
    expect(getClockGreeting(date, [familyBirthday])).toBe('🎉 Happy Birthday Emma 🎉');
  });

  it('shows anniversaries and ignores adjacent dates', () => {
    expect(getClockGreeting(new Date(2026, 8, 12, 9, 30), [familyAnniversary])).toBe(
      '💍 Happy Anniversary Alex & Jordan 💍'
    );
    expect(shouldShowClockGreeting(false, new Date(2026, 8, 13), [familyBirthday])).toBe(false);
  });
});
