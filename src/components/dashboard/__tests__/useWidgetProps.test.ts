import { buildWidgetProps } from '../useWidgetProps';

function makeDashboardData(calendarEvents: unknown[]) {
  const noop = jest.fn();
  return {
    weather: { data: null, loading: false, error: null },
    calendar: { events: calendarEvents, loading: false, error: null },
    tasks: { tasks: [], loading: false, error: null, toggleTask: noop },
    messages: { messages: [], loading: false, error: null, deleteMessage: noop },
    chores: {
      chores: [],
      loading: false,
      error: null,
      completeChore: noop,
      approveChore: noop,
      refresh: noop,
    },
    shopping: { lists: [], loading: false, error: null, toggleItem: noop },
    birthdays: { birthdays: [], loading: false, error: null },
    points: { goals: [], progress: null, goalChildren: [], loading: false, error: null },
    meals: { meals: [], loading: false, error: null, markCooked: noop, refresh: noop },
  };
}

describe('buildWidgetProps calendar data sharing', () => {
  it('passes the shared calendar event array through even when it is empty', () => {
    const events: unknown[] = [];
    const props = buildWidgetProps(
      makeDashboardData(events) as unknown as Parameters<typeof buildWidgetProps>[0],
      jest.fn(),
      {
        setShowAddTask: jest.fn(),
        setShowAddMessage: jest.fn(),
        setShowAddChore: jest.fn(),
        setShowAddShopping: jest.fn(),
      }
    );

    const calendarProps = props.calendar!;
    expect(calendarProps).toHaveProperty('events', events);
    expect(calendarProps.events).toBe(events);
  });
});
