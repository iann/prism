/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { AgendaView } from '@/components/calendar/AgendaView';
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

function expectNoUnscopedAlphaClass(relativePath: string, className: string) {
  const source = readFileSync(join(process.cwd(), relativePath), 'utf8');
  const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const unscopedClass = new RegExp(`(^|[\\s'"])${escapedClassName}($|[\\s'"])`, 'm');

  expect(source).not.toMatch(unscopedClass);
  expect(source).toContain(`dark:${className}`);
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
    expectOpaqueLightTranslucentDark(eventCard!);
    expect(eventCard!.classList.contains('border-border')).toBe(true);
    expect(eventCard!.classList.contains('border-border/40')).toBe(false);
    expect(eventCard!.classList.contains('dark:border-border/40')).toBe(true);
  });

  it('keeps residual calendar alpha utilities dark-scoped', () => {
    expectNoUnscopedAlphaClass('src/components/calendar/cells/DayColumn.tsx', 'border-border/30');
    expectNoUnscopedAlphaClass('src/components/calendar/WeekView.tsx', 'bg-card/50');
    expectNoUnscopedAlphaClass('src/components/calendar/WeekView.tsx', 'border-border/50');
    expectNoUnscopedAlphaClass('src/components/calendar/TwoWeekView.tsx', 'bg-card/50');
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
      'src/components/calendar/CalendarNotesColumn.tsx:border-border/50',
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
