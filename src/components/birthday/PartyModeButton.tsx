'use client';

import {
  getTodaysFamilyCelebrations,
  type BirthdayCelebrationRecord,
} from '@/lib/birthdayCelebration';
import { useLocalDateKey } from '@/lib/hooks/useLocalDateKey';
import { triggerBirthdayParty } from './BirthdayCelebration';

export function PartyModeButton({
  celebrations = [],
}: {
  celebrations?: readonly BirthdayCelebrationRecord[];
}) {
  const dateKey = useLocalDateKey();
  const todaysCelebrations = getTodaysFamilyCelebrations(celebrations, dateKey);

  if (todaysCelebrations.length === 0) return null;

  // The visible circle stays 56px. The button itself is padded out to an 88px
  // box (16px of transparent margin on every side) so a small child who misses
  // the circle — especially below it, where the bottom nav lives — still starts
  // the celebration instead of changing pages.
  return (
    <button
      type="button"
      aria-label="Start family celebration"
      data-auto-hide-keep
      className="group fixed bottom-0 left-0 z-[80] flex h-[88px] w-[88px] items-end justify-start bg-transparent p-4 focus-visible:outline-none"
      onClick={() => triggerBirthdayParty({ intensity: 'supernova' })}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-pink-300/80 bg-pink-100/90 p-0 text-2xl shadow-lg transition-colors group-hover:bg-pink-200 group-focus-visible:ring-2 group-focus-visible:ring-pink-500 dark:border-pink-400/50 dark:bg-pink-950/70 dark:text-pink-200 dark:group-hover:bg-pink-900/80"
      >
        🎉
      </span>
    </button>
  );
}
