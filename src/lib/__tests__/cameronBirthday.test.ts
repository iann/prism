import {
  CAMERON_BIRTHDAY_PARTY_EVENT,
  isCameronBirthday,
  isCameronBirthdayDateKey,
  selectWeighted,
  selectWeightedIndex,
} from '../cameronBirthday';

describe('Cameron birthday policy', () => {
  it('activates on September 12 using local date components', () => {
    expect(isCameronBirthday(new Date(2026, 8, 12, 23, 59))).toBe(true);
  });

  it('does not activate on adjacent dates', () => {
    expect(isCameronBirthday(new Date(2026, 8, 11))).toBe(false);
    expect(isCameronBirthday(new Date(2026, 8, 13))).toBe(false);
  });

  it('recognizes local date keys without UTC parsing', () => {
    expect(isCameronBirthdayDateKey('2026-09-12')).toBe(true);
    expect(isCameronBirthdayDateKey('2026-09-11')).toBe(false);
    expect(isCameronBirthdayDateKey('2026-09-13')).toBe(false);
    expect(isCameronBirthdayDateKey('2026-9-12')).toBe(false);
  });

  it('exports the named future party trigger event', () => {
    expect(CAMERON_BIRTHDAY_PARTY_EVENT).toBe('prism:cameron-birthday-party');
  });
});

describe('weighted birthday helpers', () => {
  const options = [
    { value: 'common', weight: 3 },
    { value: 'rare', weight: 1 },
  ] as const;

  it('uses an injected random source deterministically', () => {
    expect(selectWeightedIndex(options, () => 0)).toBe(0);
    expect(selectWeightedIndex(options, () => 0.75)).toBe(1);
    expect(selectWeighted(options, () => 0.99)).toBe('rare');
  });

  it('ignores unusable weights and returns undefined when none are usable', () => {
    expect(selectWeightedIndex([{ value: 'ignored', weight: 0 }], () => 0)).toBe(-1);
    expect(
      selectWeighted(
        [
          { value: 'ignored', weight: Number.NaN },
          { value: 'also ignored', weight: -1 },
        ],
        () => 0
      )
    ).toBeUndefined();
  });
});
