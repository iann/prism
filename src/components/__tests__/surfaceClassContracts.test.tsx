/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { AgendaView } from '@/components/calendar/AgendaView';
import { inlineAllDayEventStyle, inlineTimedEventStyle } from '@/components/calendar/eventStyles';
import { WeatherCard } from '@/components/dashboard/MobileCards';
import { Card } from '@/components/ui/card';
import type { CalendarEvent } from '@/types/calendar';

function expectOpaqueLightTranslucentDark(element: Element) {
  expect(element.classList.contains('bg-card')).toBe(true);
  expect(element.classList.contains('bg-card/85')).toBe(false);
  expect(element.classList.contains('backdrop-blur-sm')).toBe(false);
  expect(element.classList.contains('dark:bg-card/85')).toBe(true);
  expect(element.classList.contains('dark:backdrop-blur-sm')).toBe(true);
}

function expectSemanticCalendarSurface(element: Element) {
  expect(element.classList.contains('bg-calendar-surface')).toBe(true);
  expect(element.classList.contains('bg-card')).toBe(false);
  expect(element.classList.contains('dark:bg-card/85')).toBe(false);
  expect(element.classList.contains('border')).toBe(true);
  expect(element.classList.contains('border-border')).toBe(true);
  expect(element.classList.contains('dark:border-border/40')).toBe(false);
}

function expectNoClass(relativePath: string, className: string) {
  const source = readFileSync(join(process.cwd(), relativePath), 'utf8');
  const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const unscopedClass = new RegExp(`(^|[\\s'"])${escapedClassName}($|[\\s'"])`, 'm');

  expect(source).not.toMatch(unscopedClass);
}

function findProductionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : findProductionSourceFiles(entryPath);
    }
    return /\.(?:css|js|jsx|ts|tsx)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name)
      ? [entryPath]
      : [];
  });
}

function collectProductionClasses(pattern: RegExp): string[] {
  return findProductionSourceFiles(join(process.cwd(), 'src'))
    .flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      return Array.from(source.matchAll(pattern), (match) => {
        const className = match.groups?.className;
        if (!className) throw new Error(`Class capture missing for ${filePath}`);
        return `${relative(process.cwd(), filePath)}:${className}`;
      });
    })
    .sort();
}

describe('surface class contracts', () => {
  it('keeps the shared Card opaque in light mode and translucent in dark mode', () => {
    const { container } = render(<Card>Card content</Card>);

    expectOpaqueLightTranslucentDark(container.firstElementChild!);
  });

  it('uses the same contract for a representative mobile dashboard card', () => {
    const data = {
      loading: false,
      data: {
        current: {
          temperature: 68,
          description: 'Clear',
          condition: 'sunny',
        },
        units: { temperature: 'F' },
      },
    };
    const { container } = render(<WeatherCard data={data as never} />);

    expectOpaqueLightTranslucentDark(container.firstElementChild!);
  });

  it('keeps calendar event cards opaque with a full light border', () => {
    const startTime = new Date();
    startTime.setHours(12, 0, 0, 0);
    const event: CalendarEvent = {
      id: 'class-contract-event',
      title: 'Class contract event',
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60_000),
      allDay: false,
      color: '#2563eb',
      calendarName: 'Family',
      calendarId: 'family',
    };

    render(
      <DndContext>
        <AgendaView events={[event]} displayMode="cards" onEventClick={() => undefined} />
      </DndContext>
    );

    const eventCard = screen.getByText(event.title).closest('button');
    expect(eventCard).not.toBeNull();
    expectSemanticCalendarSurface(eventCard!);
  });

  it('inherits contrast ink for light-colored inline agenda events', () => {
    const startTime = new Date();
    startTime.setHours(0, 0, 0, 0);
    const event: CalendarEvent = {
      id: 'inline-orange-event',
      title: 'Inline orange event',
      startTime,
      endTime: new Date(startTime.getTime() + 24 * 60 * 60_000),
      allDay: true,
      color: '#f59e0b',
      calendarName: 'Family',
      calendarId: 'family',
    };

    render(
      <DndContext>
        <AgendaView events={[event]} displayMode="inline" onEventClick={() => undefined} />
      </DndContext>
    );

    const title = screen.getByText(event.title);
    const eventRow = title.closest('button');
    expect(eventRow).not.toBeNull();
    expect(title.classList.contains('text-white')).toBe(false);
    expect(eventRow!.style.color).toBe('rgb(0, 0, 0)');
  });

  it('keeps calendar surfaces and borders semantic across modes', () => {
    for (const relativePath of [
      'src/components/calendar/cells/DayColumn.tsx',
      'src/components/calendar/WeekView.tsx',
      'src/components/calendar/WeekVerticalView.tsx',
      'src/components/calendar/DayViewSideBySide.tsx',
      'src/components/calendar/AgendaView.tsx',
      'src/components/calendar/MonthView.tsx',
      'src/components/calendar/cells/WeekItemCard.tsx',
    ]) {
      const source = readFileSync(join(process.cwd(), relativePath), 'utf8');
      expect(source).toContain('bg-calendar-surface');
      expect(source).toContain('border-border');
      expect(source).not.toContain('dark:bg-card/');
      expect(source).not.toContain('dark:border-border/');
    }

    expectNoClass('src/components/calendar/cells/DayColumn.tsx', 'border-border/30');
    expectNoClass('src/components/calendar/WeekView.tsx', 'bg-card/50');
    expectNoClass('src/components/calendar/WeekView.tsx', 'border-border/50');
  });

  it('maps Tailwind calendar colors to the named-theme surface tokens', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('../../../tailwind.config.js') as {
      theme: { extend: { colors: { calendar: Record<string, string> } } };
    };

    expect(config.theme.extend.colors.calendar).toEqual({
      surface: 'hsl(var(--calendar-surface))',
      today: 'hsl(var(--calendar-today))',
    });
  });

  it('keeps timed inline events on semantic ink while all-day fills choose contrast ink', () => {
    expect(inlineTimedEventStyle('#2563eb', 3)).toEqual({
      backgroundColor: 'rgba(37,99,235,0.14)',
      borderLeft: '3px solid #2563eb',
      color: 'hsl(var(--foreground))',
    });
    expect(inlineAllDayEventStyle('#2563eb', 3)).toEqual({
      backgroundColor: '#2563eb',
      borderLeft: '3px solid #2563eb',
      color: '#ffffff',
    });
  });

  it('uses semantic calendar surfaces, stable today rings, and mode-aware month borders', () => {
    const month = readFileSync(
      join(process.cwd(), 'src/components/calendar/MonthView.tsx'),
      'utf8'
    );
    const multiWeek = readFileSync(
      join(process.cwd(), 'src/components/calendar/MultiWeekView.tsx'),
      'utf8'
    );
    const twoWeek = readFileSync(
      join(process.cwd(), 'src/components/calendar/TwoWeekView.tsx'),
      'utf8'
    );

    for (const source of [month, multiWeek, twoWeek]) {
      expect(source).toContain('bg-calendar-surface');
      expect(source).toContain('bg-calendar-today');
      expect(source).toMatch(/ring-(?:1|2) ring-inset ring-ring/);
    }
    expect(month).toContain("(cards || bordered) && 'border border-border'");
    expect(month).toContain("'cursor-pointer overflow-hidden rounded-md'");
  });

  it('uses semantic active calendar accents and current-color filter dots', () => {
    const calendarSources = [
      'src/components/calendar/CalendarFilterPopover.tsx',
      'src/components/calendar/DayViewSideBySide.tsx',
      'src/components/calendar/WeekVerticalView.tsx',
      'src/components/calendar/WeekView.tsx',
      'src/components/widgets/CalendarWidget.tsx',
    ]
      .map((relativePath) => readFileSync(join(process.cwd(), relativePath), 'utf8'))
      .join('\n');

    expect(calendarSources).not.toContain('bg-blue-500');
    expect(calendarSources).not.toContain('#6366f1');
    expect(calendarSources).not.toContain('rgba(255,255,255');
    expect(calendarSources).not.toMatch(/border-white(?:\/\d+)?/);
    expect(calendarSources).toContain('currentColor');
  });

  it('keeps known low-contrast widget literals out of dashboard widget sources', () => {
    const forbiddenByFile: Record<string, string[]> = {
      'src/components/widgets/BirthdaysWidget.tsx': ['text-red-500', 'text-amber-500'],
      'src/components/widgets/PointsWidget.tsx': ['text-green-500'],
      'src/components/widgets/TravelWidget.tsx': ['fill-amber-500', 'text-amber-500'],
      'src/components/widgets/WeatherWidget.tsx': ["color: '#FBBF24'", "color: '#F97316'"],
    };

    for (const [relativePath, forbidden] of Object.entries(forbiddenByFile)) {
      const source = readFileSync(join(process.cwd(), relativePath), 'utf8');
      for (const literal of forbidden) expect(source).not.toContain(literal);
    }
  });

  it('allows no translucent light card surfaces except documented visual overlays and tints', () => {
    const alphaCards = collectProductionClasses(
      /(?:^|[\s'"])(?<className>bg-card\/\d+)(?=$|[\s'"])/gm
    );

    expect(alphaCards).toEqual([
      // Goal celebration is a transient overlay over a deliberately dark scrim.
      'src/components/ui/GoalCelebration.tsx:bg-card/95',
      // This colors an hourly weather segment; it is not a card, header, or navigation surface.
      'src/components/widgets/WeatherWidget.tsx:bg-card/80',
    ]);
  });

  it('allowlists only decorative alpha hairlines in light mode', () => {
    const alphaBoundaries = collectProductionClasses(
      /(?:^|[\s'"])(?<className>(?:border-border|border-muted-foreground|hover:border-primary|hover:border-muted-foreground)\/\d+)(?=$|[\s'"])/gm
    );

    expect(alphaBoundaries).toEqual([
      'src/app/goals/GoalsView.tsx:border-border/50',
      'src/app/shopping/ShoppingCategoryCard.tsx:border-muted-foreground/30',
      'src/app/shopping/ShoppingCategoryCard.tsx:border-muted-foreground/30',
      'src/app/shopping/ShoppingCategoryCard.tsx:border-muted-foreground/30',
      'src/components/layout/CoordinateEditor.tsx:border-border/50',
      'src/components/layout/LayoutPreview.tsx:border-border/30',
      'src/components/layout/LayoutPreview.tsx:border-border/30',
      'src/components/widgets/BirthdaysWidget.tsx:border-border/50',
      'src/components/widgets/WeatherWidget.tsx:border-border/60',
      'src/components/widgets/WeatherWidget.tsx:border-border/60',
      'src/components/widgets/WeatherWidget.tsx:border-border/60',
    ]);
  });

  it('allowlists only redundant avatar initials and decorative glyphs below 12px', () => {
    const subTwelveText = collectProductionClasses(
      /(?:^|[\s'"])(?<className>text-\[(?:8|9|10|11)px\])(?=$|[\s'"])/gm
    );

    expect(subTwelveText).toEqual([
      // Decorative up/down triangle glyphs.
      'src/app/calendar/ViewMenu.tsx:text-[10px]',
      'src/app/calendar/ViewMenu.tsx:text-[10px]',
      // Avatar initials always have an adjacent full-size person name.
      'src/app/chores/ChoreCompletionsList.tsx:text-[8px]',
      'src/app/chores/ChoreItem.tsx:text-[8px]',
      'src/app/chores/ChoreItem.tsx:text-[8px]',
      'src/app/meals/MealsView.tsx:text-[8px]',
      'src/app/tasks/TaskItem.tsx:text-[8px]',
      // Decorative selected-state check glyphs.
      'src/app/travel/components/PinForm.tsx:text-[10px]',
      'src/app/travel/components/PinForm.tsx:text-[10px]',
      // Compact labels identify the device frames in the layout gallery.
      'src/components/layout/DevicePreviewGallery.tsx:text-[9px]',
      // Navigation and modal avatar initials with adjacent names or labels.
      'src/components/layout/MobileFab.tsx:text-[10px]',
      'src/components/layout/MobileNav.tsx:text-[10px]',
      'src/components/modals/AddMessageModal.tsx:text-[10px]',
      'src/components/modals/AddMessageModal.tsx:text-[10px]',
      'src/components/modals/AddMessageModal.tsx:text-[10px]',
      'src/components/modals/AddTaskModal.tsx:text-[10px]',
      // Decorative up/down triangle glyphs.
      'src/components/widgets/CalendarWidgetControls.tsx:text-[10px]',
      'src/components/widgets/CalendarWidgetControls.tsx:text-[10px]',
      // Compact avatar initials with adjacent names.
      'src/components/widgets/ChoresWidget.tsx:text-[8px]',
      'src/components/widgets/ChoresWidget.tsx:text-[8px]',
      'src/components/widgets/MealsWidget.tsx:text-[8px]',
      'src/components/widgets/MessagesWidget.tsx:text-[10px]',
      'src/components/widgets/TasksWidget.tsx:text-[8px]',
    ]);
  });
});
