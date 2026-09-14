/** Shared policy for family birthday and anniversary celebrations. */
export const BIRTHDAY_PARTY_EVENT = 'prism:birthday-party';
export const BIRTHDAY_PARTY_CANCEL_EVENT = 'prism:birthday-party-cancel';

export const BIRTHDAY_WELCOME_DELAY_MS = 1_000;
export const BIRTHDAY_MIN_SCENE_DELAY_MS = 3 * 60_000;
export const BIRTHDAY_MAX_SCENE_DELAY_MS = 5 * 60_000;

export type FamilyCelebrationType = 'birthday' | 'anniversary';

export type BirthdayCelebrationRecord = {
  name: string;
  birthDate: string;
  eventType: FamilyCelebrationType | 'milestone';
  partyModeEnabled?: boolean;
  userId?: string | null;
  user?: { id: string; name?: string | null } | null;
};

export type RandomSource = () => number;

/** Only explicitly opted-in birthday and anniversary records trigger party mode. */
export function isFamilyCelebration(record: BirthdayCelebrationRecord): boolean {
  return (
    record.partyModeEnabled === true &&
    (record.eventType === 'birthday' || record.eventType === 'anniversary')
  );
}

function monthAndDay(value: string): { month: number; day: number } | null {
  const match = /^(?:\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return { month: Number(match[1]), day: Number(match[2]) };
}

function dateParts(value: Date | string): { month: number; day: number } | null {
  if (value instanceof Date) {
    return { month: value.getMonth() + 1, day: value.getDate() };
  }
  const match = /^(?:\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { month: Number(match[1]), day: Number(match[2]) };
}

/** Checks month/day without parsing an ISO date as UTC. */
export function isFamilyCelebrationDate(
  record: BirthdayCelebrationRecord,
  date: Date | string
): boolean {
  if (!isFamilyCelebration(record)) return false;
  const eventDate = monthAndDay(record.birthDate);
  const targetDate = dateParts(date);
  return Boolean(
    eventDate &&
    targetDate &&
    eventDate.month === targetDate.month &&
    eventDate.day === targetDate.day
  );
}

export function getTodaysFamilyCelebrations(
  records: readonly BirthdayCelebrationRecord[],
  date: Date | string = new Date()
): BirthdayCelebrationRecord[] {
  return records.filter((record) => isFamilyCelebrationDate(record, date));
}

export function hasFamilyCelebrationOnDate(
  records: readonly BirthdayCelebrationRecord[],
  date: Date | string
): boolean {
  return records.some((record) => isFamilyCelebrationDate(record, date));
}

function joinNames(records: readonly BirthdayCelebrationRecord[]): string {
  const names = records.map((record) => record.user?.name || record.name);
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** Returns the compact greeting used by the clock for today's family events. */
export function formatFamilyCelebrationGreeting(
  records: readonly BirthdayCelebrationRecord[]
): string | null {
  const todays = records.filter(isFamilyCelebration);
  if (todays.length === 0) return null;

  const birthdayRecords = todays.filter((record) => record.eventType === 'birthday');
  const anniversaryRecords = todays.filter((record) => record.eventType === 'anniversary');
  const messages: string[] = [];

  if (birthdayRecords.length > 0) {
    messages.push(`🎉 Happy Birthday ${joinNames(birthdayRecords)} 🎉`);
  }
  if (anniversaryRecords.length > 0) {
    messages.push(`💍 Happy Anniversary ${joinNames(anniversaryRecords)} 💍`);
  }

  return messages.join(' · ');
}

export type WeightedOption<T> = {
  value: T;
  weight: number;
};

export function selectWeightedIndex<T>(
  options: readonly WeightedOption<T>[],
  random: RandomSource = Math.random
): number {
  const totalWeight = options.reduce(
    (total, option) =>
      total + (Number.isFinite(option.weight) && option.weight > 0 ? option.weight : 0),
    0
  );
  if (totalWeight <= 0) return -1;

  const target = Math.min(Math.max(random(), 0), 1) * totalWeight;
  let cumulative = 0;
  let lastUsableIndex = -1;
  for (let index = 0; index < options.length; index += 1) {
    const weight = options[index]?.weight ?? 0;
    if (!Number.isFinite(weight) || weight <= 0) continue;
    lastUsableIndex = index;
    cumulative += weight;
    if (target < cumulative) return index;
  }

  return lastUsableIndex;
}

export function selectWeighted<T>(
  options: readonly WeightedOption<T>[],
  random: RandomSource = Math.random
): T | undefined {
  const index = selectWeightedIndex(options, random);
  return index < 0 ? undefined : options[index]?.value;
}

/** Selects a recurring scene delay, inclusive of both three- and five-minute bounds. */
export function selectBirthdaySceneDelay(random: RandomSource = Math.random): number {
  const value = Math.min(Math.max(random(), 0), 1);
  return Math.round(
    BIRTHDAY_MIN_SCENE_DELAY_MS +
      value * (BIRTHDAY_MAX_SCENE_DELAY_MS - BIRTHDAY_MIN_SCENE_DELAY_MS)
  );
}
