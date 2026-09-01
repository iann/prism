import type { CalendarEvent } from '@/types/calendar';
import { layoutCalendarEventRows } from '../calendarEventRows';

const rowDates = Array.from({ length: 7 }, (_, index) => new Date(2026, 7, 10 + index));

function event(id: string, startDay: number, endDay: number): CalendarEvent {
  return {
    id,
    title: id,
    startTime: new Date(`2026-08-${String(startDay).padStart(2, '0')}T00:00:00.000Z`),
    endTime: new Date(`2026-08-${String(endDay).padStart(2, '0')}T00:00:00.000Z`),
    allDay: true,
    color: '#2563eb',
    calendarName: 'Family',
    calendarId: 'family',
  };
}

describe('layoutCalendarEventRows', () => {
  it('shares a lane with one-day events when their dates do not overlap', () => {
    const rows = layoutCalendarEventRows([
      event('trip', 10, 13),
      event('appointment', 13, 14),
    ], rowDates);

    expect(rows.map((row) => row.map((item) => item.id))).toEqual([
      ['trip', 'appointment'],
    ]);
  });

  it('uses a second lane only for events that overlap an existing lane', () => {
    const rows = layoutCalendarEventRows([
      event('trip', 10, 13),
      event('appointment', 11, 12),
      event('birthday', 13, 14),
    ], rowDates);

    expect(rows.map((row) => row.map((item) => item.id))).toEqual([
      ['trip', 'birthday'],
      ['appointment'],
    ]);
  });
});
