/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { CoordinateEditor } from '../CoordinateEditor';

function calendar(i: string, visible = true): WidgetConfig {
  return {
    i,
    type: 'calendar',
    x: i === 'calendar-2' ? 24 : 0,
    y: 0,
    w: 24,
    h: 24,
    visible,
  };
}

function openAddMenu() {
  fireEvent.click(screen.getByRole('button', { name: /add widget/i }));
}

describe('CoordinateEditor duplicate widget instances', () => {
  it('keeps the add picker available and creates the next unique instance ID', () => {
    const onWidgetsChange = jest.fn();
    render(
      <CoordinateEditor
        widgets={[calendar('calendar')]}
        onWidgetsChange={onWidgetsChange}
        mode="dashboard"
      />
    );

    openAddMenu();
    const calendarButtons = screen.getAllByRole('button', { name: 'Calendar', exact: true });
    fireEvent.click(calendarButtons[calendarButtons.length - 1]!);

    const nextWidgets = onWidgetsChange.mock.calls[0]![0] as WidgetConfig[];
    expect(nextWidgets).toHaveLength(2);
    expect(nextWidgets[0]).toMatchObject({ i: 'calendar', type: 'calendar' });
    expect(nextWidgets[1]).toMatchObject({ i: 'calendar-2', type: 'calendar', visible: true });
  });

  it('continues numbering correctly when adding a third instance', () => {
    const onWidgetsChange = jest.fn();
    render(
      <CoordinateEditor
        widgets={[calendar('calendar'), calendar('calendar-2')]}
        onWidgetsChange={onWidgetsChange}
        mode="dashboard"
      />
    );

    openAddMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar', exact: true }));

    const nextWidgets = onWidgetsChange.mock.calls[0]![0] as WidgetConfig[];
    expect(nextWidgets.map((widget) => widget.i)).toEqual(['calendar', 'calendar-2', 'calendar-3']);
    expect(nextWidgets[2]).toMatchObject({ type: 'calendar', visible: true });
  });

  it('hides only the selected duplicate instance', () => {
    const onWidgetsChange = jest.fn();
    render(
      <CoordinateEditor
        widgets={[calendar('calendar'), calendar('calendar-2')]}
        onWidgetsChange={onWidgetsChange}
        mode="dashboard"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Calendar 2', exact: true }));

    const nextWidgets = onWidgetsChange.mock.calls[0]![0] as WidgetConfig[];
    expect(nextWidgets).toEqual([
      expect.objectContaining({ i: 'calendar', type: 'calendar', visible: true }),
      expect.objectContaining({ i: 'calendar-2', type: 'calendar', visible: false }),
    ]);
  });

  it('retains one-instance-per-type behavior for screensavers', () => {
    const onWidgetsChange = jest.fn();
    render(
      <CoordinateEditor
        widgets={[calendar('calendar')]}
        onWidgetsChange={onWidgetsChange}
        mode="screensaver"
      />
    );

    openAddMenu();
    expect(screen.getAllByRole('button', { name: 'Calendar', exact: true })).toHaveLength(1);
    expect(onWidgetsChange).not.toHaveBeenCalled();
  });

  it('restores a hidden screensaver instance instead of creating a duplicate', () => {
    const onWidgetsChange = jest.fn();
    render(
      <CoordinateEditor
        widgets={[calendar('calendar', false)]}
        onWidgetsChange={onWidgetsChange}
        mode="screensaver"
      />
    );

    openAddMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar', exact: true }));

    const nextWidgets = onWidgetsChange.mock.calls[0]![0] as WidgetConfig[];
    expect(nextWidgets).toEqual([expect.objectContaining({ i: 'calendar', visible: true })]);
  });
});
