import type { CSSProperties } from 'react';
import { contrastText, hexToRgba } from '@/lib/utils/color';

/**
 * Inline timed events use the calendar color as an identifying stripe and
 * quiet tint. Text stays on the active theme foreground so pale calendar
 * colors never turn labels illegible in light mode.
 */
export function inlineTimedEventStyle(eventColor: string, stripeWidth = 2): CSSProperties {
  return {
    backgroundColor: hexToRgba(eventColor, 0.14),
    borderLeft: `${stripeWidth}px solid ${eventColor}`,
    color: 'hsl(var(--foreground))',
  };
}

/** Filled all-day events keep the calendar color and choose readable ink. */
export function inlineAllDayEventStyle(eventColor: string, stripeWidth = 2): CSSProperties {
  return {
    backgroundColor: eventColor,
    borderLeft: `${stripeWidth}px solid ${eventColor}`,
    color: contrastText(eventColor),
  };
}
