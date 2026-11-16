import type { CalendarEvent } from '@/types/calendar';

/**
 * Normalizes title for deduplication: trims whitespace and strips meeting platform boilerplate
 * like "'s Zoom Meeting", "Zoom call", etc.
 */
export function cleanEventTitle(title: string): string {
  if (!title) return '';
  return title
    .trim()
    .replace(/\s*['’]s?\s+(?:zoom\s+meeting|zoom\s+call|google\s+meet|teams\s+meeting)\b/i, '')
    .replace(/\s*-\s*zoom\b/i, '')
    .replace(/\s*\((?:zoom|google meet|teams)\)\s*$/i, '')
    .replace(/\s*zoom\s+meeting\b/i, '')
    .trim() || title.trim();
}

/** Check if two titles represent the same event across calendars */
function titlesMatch(a: string, b: string): boolean {
  const normA = cleanEventTitle(a).toLowerCase();
  const normB = cleanEventTitle(b).toLowerCase();
  if (normA === normB) return true;
  if (normA && normB) {
    if (normA.startsWith(normB) && (normA.length === normB.length || normA[normB.length] === ' ')) return true;
    if (normB.startsWith(normA) && (normB.length === normA.length || normB[normA.length] === ' ')) return true;
  }
  return false;
}

/**
 * One event on two people's calendars (an invite both accepted) arrives as
 * two rows, one per calendar, and showed twice, identical. Copies on
 * different calendars with the same title, start, end and all-day are one
 * event: the first stays, and keeps the others' colours, calendar names and
 * ids, so a mark can show every person and Hide can hide every copy.
 * Copies on one calendar are left alone; that is a different problem.
 */
export function mergeSharedEvents(events: CalendarEvent[]): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const e of events) {
    // Find an existing event in out from a different calendar that matches start, allDay, and title
    const first = out.find((candidate) => {
      if (candidate.calendarId === e.calendarId || (candidate.alsoCalendarIds ?? []).includes(e.calendarId)) {
        return false;
      }
      if (+candidate.startTime !== +e.startTime || candidate.allDay !== e.allDay) {
        return false;
      }
      return titlesMatch(candidate.title, e.title);
    });

    if (!first) {
      out.push(e);
      continue;
    }

    // Merge into the first copy, preferring the cleaner/more descriptive title
    const cleanE = cleanEventTitle(e.title);
    const cleanFirst = cleanEventTitle(first.title);
    const bestTitle = cleanE.length > cleanFirst.length ? cleanE : cleanFirst;

    const merged: CalendarEvent = {
      ...first,
      title: bestTitle,
      alsoIds: [...(first.alsoIds ?? []), e.id],
      alsoCalendarIds: [...(first.alsoCalendarIds ?? []), e.calendarId],
      alsoCalendarNames: [...(first.alsoCalendarNames ?? []), e.calendarName],
      alsoColors: [...new Set([...(first.alsoColors ?? []), e.color])].filter((c) => c !== first.color),
    };
    out[out.indexOf(first)] = merged;
  }
  return out;
}

/** Every person's colour on an event: its own first, then any shared copies'. */
export function eventColors(e: Pick<CalendarEvent, 'color' | 'alsoColors'>): string[] {
  return [e.color, ...(e.alsoColors ?? [])];
}

/**
 * A mark's background: one colour, or the colours in equal parts, side by
 * side for a dot ('90deg') or stacked for a thin bar ('180deg').
 */
export function eventDotBackground(e: Pick<CalendarEvent, 'color' | 'alsoColors'>, direction: '90deg' | '180deg' = '90deg'): string {
  const colors = eventColors(e);
  if (colors.length === 1) return colors[0]!;
  const step = 100 / colors.length;
  return `linear-gradient(${direction}, ${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}
