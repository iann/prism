/**
 * The 1-week, 3-week and 4-week grids were retired from the calendar page
 * (#804). A saved page choice moves to the nearest view that is kept:
 *
 * - 1W -> Schedule: the same seven days, laid out with times.
 * - 3W and 4W -> Month: the remaining page view that shows several weeks at once.
 *
 * The page's choices live in localStorage, so the move happens on read. The
 * widget has its own migration below and continues to offer 4W.
 */

export type SubpageView = 'agenda' | 'day' | 'week' | 'weekVertical' | 'multiWeek' | 'month' | 'threeMonth';

const SUBPAGE_VIEWS: SubpageView[] = ['agenda', 'day', 'week', 'weekVertical', 'multiWeek', 'month', 'threeMonth'];

/**
 * The /calendar page saved `multiWeek` plus a separate week count (1 to 4).
 * `multiWeek` now always means two weeks.
 */
export function migrateSubpageView(savedView: string | null, savedWeekCount: string | null): SubpageView {
  if (!savedView || !SUBPAGE_VIEWS.includes(savedView as SubpageView)) return 'month';
  if (savedView !== 'multiWeek') return savedView as SubpageView;
  const weeks = Number(savedWeekCount);
  if (weeks === 1) return 'week';
  if (weeks === 3 || weeks === 4) return 'month';
  return 'multiWeek';
}

export type WidgetView = 'agenda' | 'list' | 'day' | 'week' | 'multiWeek2' | 'multiWeek4' | 'month';

const WIDGET_VIEWS: WidgetView[] = ['agenda', 'list', 'day', 'week', 'multiWeek2', 'multiWeek4', 'month'];

/**
 * The calendar widget saved 1W as `multiWeek` and 3W as `multiWeek3`.
 * An older format saved `multiWeek` with the count under a separate key,
 * and older still were `twoWeek` and `list` (now Agenda).
 */
export function migrateWidgetView(saved: string | null, legacyWeekCount: string | null): WidgetView {
  switch (saved) {
    case 'twoWeek': return 'multiWeek2';
    case 'list': return 'agenda';
    case 'multiWeek3': return 'month';
    case 'multiWeek4': return 'multiWeek4';
    case 'multiWeek': {
      if (legacyWeekCount === null) return 'week';
      const weeks = Number(legacyWeekCount);
      if (weeks === 1) return 'week';
      if (weeks === 3) return 'month';
      if (weeks === 4) return 'multiWeek4';
      return 'multiWeek2';
    }
  }
  if (saved && WIDGET_VIEWS.includes(saved as WidgetView)) return saved as WidgetView;
  return 'agenda';
}
