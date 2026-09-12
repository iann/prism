'use client';

import { triggerCameronBirthdayParty } from './BirthdayCelebration';

export function CameronBirthdayPartyButton() {
  return (
    <button
      type="button"
      aria-label="Start birthday celebration"
      style={{ minHeight: 48, minWidth: 48 }}
      className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full border border-pink-300/70 bg-pink-100/80 px-3 text-sm font-semibold text-pink-700 shadow-sm transition-colors hover:bg-pink-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 dark:border-pink-400/40 dark:bg-pink-950/50 dark:text-pink-200 dark:hover:bg-pink-900/70"
      onClick={() => triggerCameronBirthdayParty({ intensity: 'supernova' })}
    >
      Party! 🎉
    </button>
  );
}
