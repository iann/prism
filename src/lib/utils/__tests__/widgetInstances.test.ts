import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import {
  getNextWidgetInstanceId,
  getWidgetType,
  normalizeWidgetInstances,
} from '../widgetInstances';

function widget(i: string, type?: string): WidgetConfig {
  return { i, type, x: 0, y: 0, w: 12, h: 12 };
}

describe('widget instance helpers', () => {
  it('keeps the explicit type separate from the instance key', () => {
    expect(getWidgetType(widget('calendar-2', 'calendar'))).toBe('calendar');
    expect(getWidgetType(widget('calendar'))).toBe('calendar');
  });

  it('generates the next available instance key', () => {
    const widgets = [widget('calendar'), widget('calendar-2')];
    expect(getNextWidgetInstanceId('calendar', widgets)).toBe('calendar-3');
    expect(getNextWidgetInstanceId('weather', widgets)).toBe('weather');
  });

  it('fills the lowest available suffix and considers every instance ID', () => {
    const widgets = [
      widget('calendar'),
      widget('calendar-2', 'tasks'),
      widget('calendar-4', 'calendar'),
    ];

    expect(getNextWidgetInstanceId('calendar', widgets)).toBe('calendar-3');
  });

  it('normalizes legacy types and repairs duplicate IDs', () => {
    const normalized = normalizeWidgetInstances([
      widget('calendar'),
      widget('calendar'),
      widget('calendar-2', 'calendar'),
    ]);

    expect(normalized.map((w) => ({ i: w.i, type: w.type }))).toEqual([
      { i: 'calendar', type: 'calendar' },
      { i: 'calendar-2', type: 'calendar' },
      { i: 'calendar-3', type: 'calendar' },
    ]);
  });

  it('allows duplicate types when instance IDs are already unique', () => {
    const widgets = [widget('calendar'), widget('calendar-2', 'calendar')];
    const normalized = normalizeWidgetInstances(widgets);

    expect(normalized.map(({ i, type }) => ({ i, type }))).toEqual([
      { i: 'calendar', type: 'calendar' },
      { i: 'calendar-2', type: 'calendar' },
    ]);
    expect(new Set(normalized.map((w) => w.i)).size).toBe(2);
  });

  it('does not mutate the source layout while repairing IDs', () => {
    const source = [widget('calendar'), widget('calendar')];
    const normalized = normalizeWidgetInstances(source);

    expect(source.map((w) => w.i)).toEqual(['calendar', 'calendar']);
    expect(normalized.map((w) => w.i)).toEqual(['calendar', 'calendar-2']);
    expect(normalized[0]).not.toBe(source[0]);
  });
});
