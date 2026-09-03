'use client';

import * as React from 'react';

export type FloatingCardStackProps = {
  children?: React.ReactNode;
  bottomOffset?: number;
};

/** Fixed desktop cards, laid out from the bottom-right and wrapping upward. */
export function FloatingCardStack({ children, bottomOffset = 0 }: FloatingCardStackProps) {
  const cards = React.Children.toArray(children).filter(Boolean);
  if (cards.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[10000] flex flex-row-reverse flex-wrap-reverse content-start items-end justify-start gap-4 overflow-visible px-4 pb-4 [padding-left:calc(1rem+env(safe-area-inset-left))] [padding-right:calc(1rem+env(safe-area-inset-right))]"
      style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))` }}
      data-testid="floating-card-stack"
    >
      {cards.map((card, index) => (
        <div
          className="pointer-events-auto min-w-0 max-w-full shrink-0 [&:empty]:hidden"
          key={index}
        >
          {card}
        </div>
      ))}
    </div>
  );
}
