'use client';

import * as React from 'react';

export type FloatingCardStackProps = {
  children?: React.ReactNode;
  bottomOffset?: number;
  /** Optional top placement for global alerts that should not cover media controls. */
  topOffset?: number;
};

/**
 * Fixed desktop cards, laid out from the bottom-right and wrapping upward.
 *
 * The half-width flex basis is intentional: flexbox decides which items
 * belong on a line before it applies `flex-shrink`. Without it, two 32rem
 * cards can wrap onto separate lines even when they would fit after the
 * stack's padding and gap are accounted for.
 */
export function FloatingCardStack({ children, bottomOffset = 0, topOffset }: FloatingCardStackProps) {
  const cards = React.Children.toArray(children).filter(Boolean);
  if (cards.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[10000] flex flex-row-reverse flex-wrap-reverse content-start items-end justify-start gap-4 overflow-visible px-4 pb-4 [padding-left:calc(1rem+env(safe-area-inset-left))] [padding-right:calc(1rem+env(safe-area-inset-right))]"
      style={topOffset == null
        ? { bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))` }
        : { top: `calc(${topOffset}px + env(safe-area-inset-top))` }}
      data-testid="floating-card-stack"
    >
      {cards.map((card, index) => (
        <div
          data-auto-hide-keep
          className="pointer-events-auto min-w-0 max-w-full [&:empty]:hidden"
          style={{
            flex: '1 1 min(32rem, calc((100% - 1rem) / 2))',
            maxWidth: '32rem',
          }}
          key={index}
        >
          {card}
        </div>
      ))}
    </div>
  );
}
