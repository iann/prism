import type { CalendarEvent } from '@/types/calendar';
import { eventOccursOnDisplayDay } from './timeFormat';

/**
 * Arrange calendar events into shared horizontal lanes.
 *
 * Events that do not occupy the same displayed day can share a lane. This is
 * what lets a one-day event sit alongside a multi-day bar instead of being
 * pushed below the entire row of spanning events.
 */
export function layoutCalendarEventRows(
  events: CalendarEvent[],
  rowDates: Date[],
  timeZone?: string,
): CalendarEvent[][] {
  if (events.length === 0 || rowDates.length === 0) return [];

  const positioned = events
    .map((event) => {
      const dayIndexes = rowDates.reduce<number[]>((indexes, date, index) => {
        if (eventOccursOnDisplayDay(
          event.startTime,
          event.endTime,
          event.allDay,
          date,
          timeZone,
        )) {
          indexes.push(index);
        }
        return indexes;
      }, []);

      return { event, dayIndexes };
    })
    .filter(({ dayIndexes }) => dayIndexes.length > 0)
    .sort((a, b) => {
      const firstDay = a.dayIndexes[0]! - b.dayIndexes[0]!;
      if (firstDay !== 0) return firstDay;

      // Give longer events the first chance at a lane so a one-day event can
      // reuse it later in the week whenever the dates do not overlap.
      const lastDay = b.dayIndexes[b.dayIndexes.length - 1]! - a.dayIndexes[a.dayIndexes.length - 1]!;
      if (lastDay !== 0) return lastDay;

      const startTime = a.event.startTime.getTime() - b.event.startTime.getTime();
      if (startTime !== 0) return startTime;
      return a.event.title.localeCompare(b.event.title);
    });

  const rows: Array<{ events: CalendarEvent[]; occupiedDays: Set<number> }> = [];

  for (const item of positioned) {
    const row = rows.find(({ occupiedDays }) =>
      item.dayIndexes.every((dayIndex) => !occupiedDays.has(dayIndex))
    );

    if (row) {
      row.events.push(item.event);
      item.dayIndexes.forEach((dayIndex) => row.occupiedDays.add(dayIndex));
    } else {
      rows.push({
        events: [item.event],
        occupiedDays: new Set(item.dayIndexes),
      });
    }
  }

  return rows.map(({ events: rowEvents }) => rowEvents);
}
