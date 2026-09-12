'use client';

import { isCameronBirthdayDateKey } from '@/lib/cameronBirthday';
import { useLocalDateKey } from '@/lib/hooks/useLocalDateKey';
import { triggerCameronBirthdayParty } from './BirthdayCelebration';

export function CameronBirthdayPartyButton() {
  const dateKey = useLocalDateKey();

  if (!isCameronBirthdayDateKey(dateKey)) return null;

  return (
    <button
      type="button"
      aria-label="Start birthday celebration"
      data-auto-hide-keep
      style={{ minHeight: 56, minWidth: 56 }}
      className="fixed bottom-4 left-4 z-[80] inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-pink-300/80 bg-pink-100/90 p-0 text-2xl shadow-lg transition-colors hover:bg-pink-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 dark:border-pink-400/50 dark:bg-pink-950/70 dark:text-pink-200 dark:hover:bg-pink-900/80"
      onClick={() => triggerCameronBirthdayParty({ intensity: 'supernova' })}
    >
      <span aria-hidden="true">🎉</span>
    </button>
  );
}
