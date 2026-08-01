import type { WidgetConfig } from '@/lib/hooks/useLayouts';

/**
 * The registry type identifies what a widget renders; `i` identifies the
 * individual instance in a layout. Older layouts used `i` for both values.
 */
export function getWidgetType(widget: Pick<WidgetConfig, 'i' | 'type'>): string {
  return widget.type || widget.i;
}

export function getNextWidgetInstanceId(
  type: string,
  widgets: Array<Pick<WidgetConfig, 'i'>>
): string {
  const used = new Set(widgets.map((widget) => widget.i));
  if (!used.has(type)) return type;

  let suffix = 2;
  while (used.has(`${type}-${suffix}`)) suffix++;
  return `${type}-${suffix}`;
}

/**
 * Normalize legacy layout entries and repair duplicate instance IDs from
 * hand-edited/imported layouts without changing their registry type.
 */
export function normalizeWidgetInstances(widgets: WidgetConfig[]): WidgetConfig[] {
  const used = new Set<string>();

  return widgets.map((widget) => {
    const type = getWidgetType(widget);
    let instanceId = widget.i || type;

    if (used.has(instanceId)) {
      let suffix = 2;
      while (used.has(`${type}-${suffix}`)) suffix++;
      instanceId = `${type}-${suffix}`;
    }

    used.add(instanceId);
    return { ...widget, i: instanceId, type };
  });
}
