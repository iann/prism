import {
  BIRTHDAY_PARTY_EVENT,
  formatFamilyCelebrationGreeting,
  getTodaysFamilyCelebrations,
  hasFamilyCelebrationOnDate,
  isFamilyCelebrationDate,
  selectBirthdaySceneDelay,
  selectWeighted,
  selectWeightedIndex,
} from '../birthdayCelebration';

const birthday = {
  name: 'Sample Person',
  birthDate: '2014-02-15',
  eventType: 'birthday' as const,
  partyModeEnabled: true,
  userId: 'family-sample-person',
};

const anniversary = {
  name: 'Example Couple',
  birthDate: '2010-02-15',
  eventType: 'anniversary' as const,
  partyModeEnabled: true,
  user: { id: 'family-example-couple', name: 'Example Couple' },
};

describe('family celebration policy', () => {
  it('activates birthdays and anniversaries for linked family members', () => {
    const date = new Date(2026, 1, 15, 23, 59);

    expect(isFamilyCelebrationDate(birthday, date)).toBe(true);
    expect(isFamilyCelebrationDate(anniversary, date)).toBe(true);
    expect(getTodaysFamilyCelebrations([birthday, anniversary], date)).toHaveLength(2);
    expect(hasFamilyCelebrationOnDate([birthday], '2026-02-15')).toBe(true);
  });

  it('includes unlinked extended-family records but ignores milestones', () => {
    const extendedFamilyBirthday = { ...birthday, name: 'Extended Family', userId: null };
    const milestone = { ...birthday, eventType: 'milestone' as const };

    expect(isFamilyCelebrationDate(extendedFamilyBirthday, new Date(2026, 1, 15))).toBe(true);
    expect(isFamilyCelebrationDate(milestone, new Date(2026, 1, 15))).toBe(false);
    expect(getTodaysFamilyCelebrations([extendedFamilyBirthday, milestone], '2026-02-15')).toEqual([
      extendedFamilyBirthday,
    ]);
  });

  it('ignores birthday and anniversary records that are not opted in', () => {
    const unmarked = { ...birthday, partyModeEnabled: false };

    expect(isFamilyCelebrationDate(unmarked, '2026-02-15')).toBe(false);
    expect(getTodaysFamilyCelebrations([unmarked], '2026-02-15')).toEqual([]);
    expect(formatFamilyCelebrationGreeting([unmarked])).toBeNull();
  });

  it('formats birthday and anniversary greetings together', () => {
    expect(formatFamilyCelebrationGreeting([birthday, anniversary])).toBe(
      '🎉 Happy Birthday Sample Person 🎉 · 💍 Happy Anniversary Example Couple 💍'
    );
  });

  it('uses a universal party event and bounded scene delays', () => {
    expect(BIRTHDAY_PARTY_EVENT).toBe('prism:birthday-party');
    expect(selectBirthdaySceneDelay(() => 0)).toBe(3 * 60_000);
    expect(selectBirthdaySceneDelay(() => 1)).toBe(5 * 60_000);
  });
});

describe('weighted celebration helpers', () => {
  const options = [
    { value: 'common', weight: 3 },
    { value: 'rare', weight: 1 },
  ] as const;

  it('uses an injected random source deterministically', () => {
    expect(selectWeightedIndex(options, () => 0)).toBe(0);
    expect(selectWeightedIndex(options, () => 0.75)).toBe(1);
    expect(selectWeighted(options, () => 0.99)).toBe('rare');
  });
});
