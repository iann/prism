import { buildWidgetProps } from '../useWidgetProps';

function makeDashboardData(calendarEvents: unknown[]) {
  const noop = jest.fn();
  return {
    weather: { data: null, loading: false, error: null, enabled: true, refresh: noop },
    calendar: { events: calendarEvents, loading: false, error: null, enabled: true, refresh: noop },
    tasks: {
      tasks: [],
      calendarTasks: calendarEvents,
      loading: false,
      error: null,
      enabled: true,
      refresh: noop,
      toggleTask: noop,
    },
    messages: { messages: [], loading: false, error: null, deleteMessage: noop },
    chores: {
      chores: [],
      calendarChores: calendarEvents,
      loading: false,
      error: null,
      enabled: true,
      refresh: noop,
      completeChore: noop,
      approveChore: noop,
    },
    shopping: { lists: [], loading: false, error: null, toggleItem: noop },
    birthdays: { birthdays: [], loading: false, error: null },
    points: { goals: [], progress: null, goalChildren: [], loading: false, error: null },
    meals: { meals: calendarEvents, loading: false, error: null, enabled: true, markCooked: noop, refresh: noop },
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

  it('passes active dashboard streams to calendar overlays', () => {
    const meals: unknown[] = [{ id: 'meal-1' }];
    const data = makeDashboardData([]);
    data.meals.meals = meals;
    data.chores.calendarChores = meals;
    data.tasks.calendarTasks = meals;

    const props = buildWidgetProps(
      data as unknown as Parameters<typeof buildWidgetProps>[0],
      jest.fn(),
      {
        setShowAddTask: jest.fn(),
        setShowAddMessage: jest.fn(),
        setShowAddChore: jest.fn(),
        setShowAddShopping: jest.fn(),
      }
    );

    expect(props.calendar!.overlayMeals).toBe(meals);
    expect(props.calendar!.overlayChores).toBe(meals);
    expect(props.calendar!.overlayTasks).toBe(meals);
  });
});
