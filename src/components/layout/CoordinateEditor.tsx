'use client';

import * as React from 'react';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { WIDGET_COLORS } from './LayoutPreview';
import {
  WIDGET_REGISTRY,
  ALL_WIDGET_TYPES,
  SCREENSAVER_WIDGETS,
} from '@/components/widgets/widgetRegistry';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { findNextFreeSlot } from '@/lib/utils/widgetPlacement';
import { getNextWidgetInstanceId, getWidgetType } from '@/lib/utils/widgetInstances';

interface CoordinateEditorProps {
  widgets: WidgetConfig[];
  onWidgetsChange: (widgets: WidgetConfig[]) => void;
  mode: 'dashboard' | 'screensaver';
  onFocusedWidgetChange?: (widgetId: string | null) => void;
}

export function CoordinateEditor({
  widgets,
  onWidgetsChange,
  mode,
  onFocusedWidgetChange,
}: CoordinateEditorProps) {
  const [focusedWidget, setFocusedWidget] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  const handleFocusChange = useCallback(
    (widgetId: string | null) => {
      setFocusedWidget(widgetId);
      onFocusedWidgetChange?.(widgetId);
    },
    [onFocusedWidgetChange]
  );

  const allWidgetIds =
    mode === 'screensaver' ? SCREENSAVER_WIDGETS.map((w) => w.id) : ALL_WIDGET_TYPES;

  const byLabel = (a: string, b: string) => {
    const aLabel = WIDGET_REGISTRY[a]?.label || a;
    const bLabel = WIDGET_REGISTRY[b]?.label || b;
    return aLabel.localeCompare(bLabel);
  };

  // The dashboard picker intentionally keeps every type available so a
  // second (or third) instance can be added. Screensaver editing retains its
  // original one-instance-per-type behavior.
  const hiddenIds = useMemo(() => {
    if (mode !== 'screensaver') return [...allWidgetIds].sort(byLabel);
    return allWidgetIds
      .filter((type) => !widgets.some((w) => getWidgetType(w) === type && w.visible !== false))
      .sort(byLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allWidgetIds, mode, widgets]);

  const visibleWidgets = useMemo(
    () =>
      widgets
        .filter((w) => w.visible !== false)
        .sort((a, b) => {
          const byType = byLabel(getWidgetType(a), getWidgetType(b));
          return byType || a.i.localeCompare(b.i);
        }),
    [widgets]
  );

  // Close add dropdown on outside click
  useEffect(() => {
    if (!addOpen) return;
    const handler = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addOpen]);

  const handleAddWidget = useCallback(
    (widgetType: string) => {
      const reg = WIDGET_REGISTRY[widgetType];
      if (!reg) return;

      if (mode === 'screensaver') {
        const exists = widgets.find((w) => getWidgetType(w) === widgetType);
        if (exists) {
          onWidgetsChange(widgets.map((w) => (w.i === exists.i ? { ...w, visible: true } : w)));
        } else {
          const { x, y } = findNextFreeSlot(widgets, reg.defaultW, reg.defaultH);
          onWidgetsChange([
            ...widgets,
            {
              i: widgetType,
              type: widgetType,
              x,
              y,
              w: reg.defaultW,
              h: reg.defaultH,
              visible: true,
            },
          ]);
        }
        return;
      }

      const instanceId = getNextWidgetInstanceId(widgetType, widgets);
      const { x, y } = findNextFreeSlot(widgets, reg.defaultW, reg.defaultH);
      onWidgetsChange([
        ...widgets,
        { i: instanceId, type: widgetType, x, y, w: reg.defaultW, h: reg.defaultH, visible: true },
      ]);
    },
    [mode, widgets, onWidgetsChange]
  );

  const handleRemoveWidget = useCallback(
    (instanceId: string) => {
      onWidgetsChange(widgets.map((w) => (w.i === instanceId ? { ...w, visible: false } : w)));
    },
    [widgets, onWidgetsChange]
  );

  const handleUpdateWidget = useCallback(
    (instanceId: string, field: 'x' | 'y' | 'w' | 'h', value: number) => {
      onWidgetsChange(widgets.map((w) => (w.i === instanceId ? { ...w, [field]: value } : w)));
    },
    [widgets, onWidgetsChange]
  );

  return (
    <div className="space-y-1.5">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-1 py-1 text-left">Widget</th>
            <th className="w-11 px-0.5 py-1 text-center">X</th>
            <th className="w-11 px-0.5 py-1 text-center">Y</th>
            <th className="w-11 px-0.5 py-1 text-center">W</th>
            <th className="w-11 px-0.5 py-1 text-center">H</th>
          </tr>
        </thead>
        <tbody>
          {visibleWidgets.map((widget, index) => {
            const widgetType = getWidgetType(widget);
            const reg = WIDGET_REGISTRY[widgetType];
            const color = WIDGET_COLORS[widgetType] || '#6B7280';
            const isFocused = focusedWidget === widget.i;
            const sameTypeCount = visibleWidgets.filter(
              (w) => getWidgetType(w) === widgetType
            ).length;
            const ordinal = visibleWidgets
              .slice(0, index + 1)
              .filter((w) => getWidgetType(w) === widgetType).length;
            const label =
              sameTypeCount > 1
                ? `${reg?.label || widgetType} ${ordinal}`
                : reg?.label || widgetType;

            return (
              <tr
                key={widget.i}
                className={`border-b border-border/50 transition-colors ${
                  isFocused ? 'bg-primary/5' : ''
                }`}
              >
                <td className="px-1 py-1">
                  <button
                    onClick={() => handleRemoveWidget(widget.i)}
                    className="w-full whitespace-nowrap rounded px-1.5 py-0.5 text-left text-xs text-white transition-colors"
                    style={{
                      backgroundColor: color,
                      border: `1px solid ${color}`,
                    }}
                    title="Click to hide"
                  >
                    {label}
                  </button>
                </td>
                <td className="px-0.5 py-1">
                  <CoordInput
                    value={widget.x}
                    min={0}
                    max={47}
                    onChange={(v) => handleUpdateWidget(widget.i, 'x', v)}
                    onFocus={() => handleFocusChange(widget.i)}
                    onBlur={() => handleFocusChange(null)}
                  />
                </td>
                <td className="px-0.5 py-1">
                  <CoordInput
                    value={widget.y}
                    min={0}
                    max={119}
                    onChange={(v) => handleUpdateWidget(widget.i, 'y', v)}
                    onFocus={() => handleFocusChange(widget.i)}
                    onBlur={() => handleFocusChange(null)}
                  />
                </td>
                <td className="px-0.5 py-1">
                  <CoordInput
                    value={widget.w}
                    min={reg?.minW ?? 1}
                    max={48}
                    onChange={(v) => handleUpdateWidget(widget.i, 'w', v)}
                    onFocus={() => handleFocusChange(widget.i)}
                    onBlur={() => handleFocusChange(null)}
                  />
                </td>
                <td className="px-0.5 py-1">
                  <CoordInput
                    value={widget.h}
                    min={reg?.minH ?? 1}
                    max={120}
                    onChange={(v) => handleUpdateWidget(widget.i, 'h', v)}
                    onFocus={() => handleFocusChange(widget.i)}
                    onBlur={() => handleFocusChange(null)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Add widget dropdown */}
      {hiddenIds.length > 0 && (
        <div className="relative" ref={addRef}>
          <button
            onClick={() => setAddOpen((prev) => !prev)}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-muted px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent active:scale-[0.98]"
          >
            + Add widget
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${addOpen ? '' : 'rotate-180'}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {addOpen && (
            <div className="mt-1 max-h-[40vh] overflow-auto rounded-md border border-border py-1">
              {hiddenIds.map((type) => {
                const reg = WIDGET_REGISTRY[type];
                const color = WIDGET_COLORS[type] || '#6B7280';
                return (
                  <button
                    key={type}
                    onClick={() => {
                      handleAddWidget(type);
                    }}
                    className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left text-base transition-colors hover:bg-accent"
                  >
                    <span
                      className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {reg?.label || type}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CoordInput({
  value,
  min,
  max,
  onChange,
  onFocus,
  onBlur,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      className="w-full rounded border border-border bg-muted px-1 py-0.5 text-center text-xs text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}
