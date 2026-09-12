/** Cameron's annual birthday policy, kept independent of any presentation. */
export const CAMERON_BIRTHDAY_MONTH = 9;
export const CAMERON_BIRTHDAY_DAY = 12;
export const CAMERON_BIRTHDAY_GREETING = 'Happy Birthday Cameron!!!';

/** Event name reserved for the later party-mode trigger. */
export const CAMERON_BIRTHDAY_PARTY_EVENT = 'prism:cameron-birthday-party';
export const CAMERON_BIRTHDAY_PARTY_CANCEL_EVENT = 'prism:cameron-birthday-party-cancel';

/** Browser-local date components determine whether the policy is active. */
export function isCameronBirthday(date: Date): boolean {
  return date.getMonth() + 1 === CAMERON_BIRTHDAY_MONTH && date.getDate() === CAMERON_BIRTHDAY_DAY;
}

/** Checks a local `YYYY-MM-DD` date key without parsing it as a UTC date. */
export function isCameronBirthdayDateKey(key: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return (
    match?.[2] === String(CAMERON_BIRTHDAY_MONTH).padStart(2, '0') &&
    match?.[3] === String(CAMERON_BIRTHDAY_DAY).padStart(2, '0')
  );
}

export type WeightedOption<T> = {
  value: T;
  weight: number;
};

export type RandomSource = () => number;

export const CAMERON_BIRTHDAY_WELCOME_DELAY_MS = 1_000;
export const CAMERON_BIRTHDAY_MIN_SCENE_DELAY_MS = 3 * 60_000;
export const CAMERON_BIRTHDAY_MAX_SCENE_DELAY_MS = 5 * 60_000;

/** Selects the next scene delay, including both three- and five-minute bounds. */
export function selectCameronBirthdaySceneDelay(random: RandomSource = Math.random): number {
  const value = Math.min(Math.max(random(), 0), 1);
  return Math.round(
    CAMERON_BIRTHDAY_MIN_SCENE_DELAY_MS +
      value * (CAMERON_BIRTHDAY_MAX_SCENE_DELAY_MS - CAMERON_BIRTHDAY_MIN_SCENE_DELAY_MS)
  );
}

/** Returns the selected index for a deterministic, injectable random value. */
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

/** Returns a weighted value, or undefined when no option has usable weight. */
export function selectWeighted<T>(
  options: readonly WeightedOption<T>[],
  random: RandomSource = Math.random
): T | undefined {
  const index = selectWeightedIndex(options, random);
  return index < 0 ? undefined : options[index]?.value;
}
