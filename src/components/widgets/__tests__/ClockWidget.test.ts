import { millisecondsUntilNextClockTick } from '../ClockWidget';

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
