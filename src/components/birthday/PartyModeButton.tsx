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

  return (
    <button
      type="button"
      aria-label="Start family celebration"
      data-auto-hide-keep
      style={{ minHeight: 56, minWidth: 56 }}
      className="fixed bottom-4 left-4 z-[80] inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-pink-300/80 bg-pink-100/90 p-0 text-2xl shadow-lg transition-colors hover:bg-pink-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 dark:border-pink-400/50 dark:bg-pink-950/70 dark:text-pink-200 dark:hover:bg-pink-900/80"
      onClick={() => triggerBirthdayParty({ intensity: 'supernova' })}
    >
      <span aria-hidden="true">🎉</span>
    </button>
  );
}
