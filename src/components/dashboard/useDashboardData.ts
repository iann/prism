import { useEffect, useCallback, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { useCalendarEvents, useWeather, useMessages, useTasks, useChores, useShoppingLists, useMeals, useBirthdays, useLayouts, useGoals, usePoints } from '@/lib/hooks';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import type { Chore } from '@/types';

const AUTO_SYNC_STALE_MINUTES = 5;
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
export const DASHBOARD_POLL_OFFSETS = {
  weather: 0,
  messages: 5_000,
  tasks: 10_000,
  chores: 20_000,
  shopping: 30_000,
  meals: 40_000,
  calendar: 50_000,
  goals: 0,
  points: 10_000,
  birthdays: 20_000,
  taskSync: 60_000,
} as const;

const WIDGET_DOMAIN_MAP: Record<string, string[]> = {
  calendar: ['calendar'],
  weather: ['weather'],
  messages: ['messages'],
  tasks: ['tasks'],
  chores: ['chores'],
  shopping: ['shopping'],
  meals: ['meals'],
  birthdays: ['birthdays'],
  points: ['goals', 'points'],
};

export function getEnabledDashboardDomains(visibleWidgets?: Set<string>) {
  const enabled = new Set<string>();
  if (!visibleWidgets) return enabled;

  for (const [widget, domains] of Object.entries(WIDGET_DOMAIN_MAP)) {
    if (visibleWidgets.has(widget)) {
      for (const domain of domains) enabled.add(domain);
    }
  }

  return enabled;
}

export function useDashboardData(visibleWidgets?: Set<string>) {
  const enabledDomains = useMemo(
    () => getEnabledDashboardDomains(visibleWidgets),
    [visibleWidgets]
  );

  const isEnabled = (domain: string) => enabledDomains.has(domain);
  const calendarEnabled = isEnabled('calendar');
  const weatherEnabled = isEnabled('weather');
  const choresEnabled = isEnabled('chores');
  const tasksEnabled = isEnabled('tasks');
  const mealsEnabled = isEnabled('meals');

  const {
    events: calendarEvents,
    loading: calendarLoading,
    error: calendarError,
    refresh: refreshCalendar,
  } = useCalendarEvents({ daysToShow: 30, refreshOffsetMs: DASHBOARD_POLL_OFFSETS.calendar, enabled: calendarEnabled });

  const {
    data: weatherData,
    loading: weatherLoading,
    error: weatherError,
    refresh: refreshWeather,
  } = useWeather({ refreshOffsetMs: DASHBOARD_POLL_OFFSETS.weather, enabled: weatherEnabled });

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    refresh: refreshMessages,
    deleteMessage,
  } = useMessages({ limit: 10, refreshOffsetMs: DASHBOARD_POLL_OFFSETS.messages, enabled: isEnabled('messages') });

  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    refresh: refreshTasks,
    toggleTask,
  } = useTasks({
    showCompleted: true,
    // Calendar overlays need a larger window than the compact Tasks widget.
    // Fetch the superset once and slice the widget view below instead of
    // starting a second task request from the calendar.
    limit: calendarEnabled ? 50 : 20,
    refreshOffsetMs: DASHBOARD_POLL_OFFSETS.tasks,
    enabled: tasksEnabled,
  });

  const {
    chores,
    loading: choresLoading,
    error: choresError,
    refresh: refreshChores,
    completeChore,
    approveChore,
  } = useChores({
    showDisabled: false,
    // Calendar overlays must retain future-dated chores for drag-and-drop.
    // The dashboard list is filtered back to its original due-only behavior
    // below, so both consumers share this one request without changing the
    // compact widget's contents.
    includeFuture: calendarEnabled,
    refreshOffsetMs: DASHBOARD_POLL_OFFSETS.chores,
    enabled: choresEnabled,
  });

  const {
    lists: shoppingLists,
    loading: shoppingLoading,
    error: shoppingError,
    refresh: refreshShopping,
    toggleItem: toggleShoppingItem,
  } = useShoppingLists({ refreshOffsetMs: DASHBOARD_POLL_OFFSETS.shopping, enabled: isEnabled('shopping') });

  const {
    meals,
    loading: mealsLoading,
    error: mealsError,
    refresh: refreshMeals,
    markCooked,
  } = useMeals({ refreshOffsetMs: DASHBOARD_POLL_OFFSETS.meals, enabled: mealsEnabled });

  const {
    birthdays: birthdaysList,
    loading: birthdaysLoading,
    error: birthdaysError,
    syncFromGoogle: syncBirthdays,
  } = useBirthdays({ limit: 8, refreshOffsetMs: DASHBOARD_POLL_OFFSETS.birthdays, enabled: isEnabled('birthdays') });

  const {
    goals: goalsList,
    progress: goalsProgress,
    goalChildren,
    loading: goalsLoading,
    error: goalsError,
  } = useGoals({ refreshOffsetMs: DASHBOARD_POLL_OFFSETS.goals, enabled: isEnabled('goals') });

  const {
    points: pointsList,
    loading: pointsLoading,
    error: pointsError,
  } = usePoints({ refreshOffsetMs: DASHBOARD_POLL_OFFSETS.points, enabled: isEnabled('points') });

  // Layouts always load — needed for dashboard structure
  const {
    layouts: allLayouts,
    activeLayout: savedLayout,
    saveLayout,
    deleteLayout,
    loading: layoutsLoading,
  } = useLayouts();

  // Auto-sync task sources when dashboard is visible
  const lastAutoSyncRef = useRef<number>(0);

  const autoSyncTasks = useCallback(async () => {
    if (!tasksEnabled) return;

    // Skip sync in guest/display mode — no session cookie means no write access
    if (typeof document !== 'undefined' && !document.cookie.includes('prism_session')) return;

    const now = Date.now();
    if (now - lastAutoSyncRef.current < AUTO_SYNC_INTERVAL_MS) return;

    try {
      const res = await fetch(`/api/task-sources/sync-all?staleMinutes=${AUTO_SYNC_STALE_MINUTES}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.synced > 0) {
          refreshTasks();
        }
        lastAutoSyncRef.current = now;
      }
    } catch {
      // Silently fail auto-sync
    }
  }, [tasksEnabled, refreshTasks]);

  useEffect(() => {
    autoSyncTasks();
  }, [autoSyncTasks]);

  useVisibilityPolling(
    autoSyncTasks,
    tasksEnabled ? AUTO_SYNC_INTERVAL_MS : 0,
    DASHBOARD_POLL_OFFSETS.taskSync,
  );

  const dashboardTasks = useMemo(
    () => (calendarEnabled ? tasks.slice(0, 20) : tasks),
    [calendarEnabled, tasks],
  );
  const calendarTasks = calendarEnabled ? tasks : undefined;

  const dashboardChores = useMemo(() => {
    if (!calendarEnabled) return chores;

    const today = format(new Date(), 'yyyy-MM-dd');
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return chores.filter((chore: Chore) => {
      const isDue = !chore.nextDue || chore.nextDue <= today;
      const recentlyCompleted = chore.lastCompleted
        ? new Date(chore.lastCompleted).getTime() > oneDayAgo
        : false;
      return isDue || Boolean(chore.pendingApproval) || recentlyCompleted;
    });
  }, [calendarEnabled, chores]);
  const calendarChores = calendarEnabled ? chores : undefined;

  const calendar = useMemo(
    () => ({
      events: calendarEvents,
      loading: calendarLoading,
      error: calendarError,
      refresh: refreshCalendar,
      enabled: calendarEnabled,
    }),
    [calendarEnabled, calendarEvents, calendarError, calendarLoading, refreshCalendar],
  );
  const weather = useMemo(
    () => ({
      data: weatherData,
      loading: weatherLoading,
      error: weatherError,
      refresh: refreshWeather,
      enabled: weatherEnabled,
    }),
    [weatherData, weatherLoading, weatherError, refreshWeather, weatherEnabled],
  );
  const messageData = useMemo(
    () => ({ messages, loading: messagesLoading, error: messagesError, refresh: refreshMessages, deleteMessage }),
    [messages, messagesLoading, messagesError, refreshMessages, deleteMessage],
  );
  const taskData = useMemo(
    () => ({
      tasks: dashboardTasks,
      calendarTasks,
      loading: tasksLoading,
      error: tasksError,
      refresh: refreshTasks,
      toggleTask,
      enabled: tasksEnabled,
    }),
    [calendarTasks, dashboardTasks, tasksEnabled, tasksError, tasksLoading, refreshTasks, toggleTask],
  );
  const choreData = useMemo(
    () => ({
      chores: dashboardChores,
      calendarChores,
      loading: choresLoading,
      error: choresError,
      refresh: refreshChores,
      completeChore,
      approveChore,
      enabled: choresEnabled,
    }),
    [approveChore, calendarChores, choresEnabled, choresError, choresLoading, completeChore, dashboardChores, refreshChores],
  );
  const shopping = useMemo(
    () => ({ lists: shoppingLists, loading: shoppingLoading, error: shoppingError, refresh: refreshShopping, toggleItem: toggleShoppingItem }),
    [shoppingLists, shoppingLoading, shoppingError, refreshShopping, toggleShoppingItem],
  );
  const mealData = useMemo(
    () => ({
      meals,
      loading: mealsLoading,
      error: mealsError,
      refresh: refreshMeals,
      markCooked,
      enabled: mealsEnabled,
    }),
    [meals, mealsLoading, mealsError, refreshMeals, markCooked, mealsEnabled],
  );
  const birthdays = useMemo(
    () => ({ birthdays: birthdaysList, loading: birthdaysLoading, error: birthdaysError, syncFromGoogle: syncBirthdays }),
    [birthdaysList, birthdaysLoading, birthdaysError, syncBirthdays],
  );
  const points = useMemo(
    () => ({ points: pointsList, goals: goalsList, progress: goalsProgress, goalChildren, loading: pointsLoading || goalsLoading, error: pointsError || goalsError }),
    [pointsList, goalsList, goalsProgress, goalChildren, pointsLoading, goalsLoading, pointsError, goalsError],
  );
  const layouts = useMemo(
    () => ({ allLayouts, savedLayout, saveLayout, deleteLayout, loading: layoutsLoading }),
    [allLayouts, savedLayout, saveLayout, deleteLayout, layoutsLoading],
  );

  return useMemo(() => ({
    calendar,
    weather,
    messages: messageData,
    tasks: taskData,
    chores: choreData,
    shopping,
    meals: mealData,
    birthdays,
    points,
    layouts,
  }), [calendar, weather, messageData, taskData, choreData, shopping, mealData, birthdays, points, layouts]);
}
