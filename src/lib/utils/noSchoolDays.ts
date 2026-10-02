import { getDay } from 'date-fns';
import type { CalendarEvent } from '@/types/calendar';

// Calendar feeds do not expose a portable "no school" flag. Families can
// still mark those dates with ordinary all-day events using familiar wording.
const NO_SCHOOL_EVENT_PATTERN = /\b(holiday|no\s+school|school\s+closed|step[\s-]*(?:1|one)\s*[:\-]?\s*(?:is\s+)?(?:closed|closure)|teacher(?:'s)?\s+(?:workday|in[- ]service)|professional\s+development|in[- ]service|school\s+break|spring\s+break|winter\s+break|fall\s+break|summer\s+break|vacation|thanksgiving|christmas|new\s+year|memorial\s+day|labor\s+day|independence\s+day|martin\s+luther\s+king|president(?:s|s')?\s+day|juneteenth|veterans?\s+day|columbus\s+day|indigenous\s+peoples?\s+day|good\s+friday|easter)\b/i;

export function isWeekend(date: Date): boolean {
  const day = getDay(date);
  return day === 0 || day === 6;
}

export function isNoSchoolEvent(event: CalendarEvent): boolean {
  if (!event.allDay) return false;
  return NO_SCHOOL_EVENT_PATTERN.test(`${event.title} ${event.calendarName}`);
}
