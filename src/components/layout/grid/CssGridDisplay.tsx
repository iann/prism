'use client';

import { memo, useMemo } from 'react';
import { WidgetBgOverrideProvider } from '@/components/widgets/WidgetContainer';
import { getWidgetStyle, getWidgetContentStyle, getTextColorClass } from './gridWidgetStyles';
import { useSquareCells } from './useSquareCells';
import { GRID_COLS } from '@/lib/constants/grid';
import type { CssGridDisplayProps } from './gridEditorTypes';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

interface WidgetCellProps {
  widget: WidgetConfig;
  renderWidget: CssGridDisplayProps['renderWidget'];
  revision: unknown;
}

const WidgetCell = memo(function WidgetCell({ widget, renderWidget }: WidgetCellProps) {
  const widgetStyle = getWidgetStyle(widget);
  const contentStyle = getWidgetContentStyle(widget);
  const textClass = getTextColorClass(widget);
  const background = {
    hasCustomBg: !!widget.backgroundColor,
    textColor: widget.textColor,
    textOpacity: widget.textOpacity,
    gridLineOpacity: widget.gridLineOpacity,
    cellBackgroundColor: widget.cellBackgroundColor,
    cellBackgroundOpacity: widget.cellBackgroundOpacity,
  };

  return (
    <div
      className={`widget-cell relative overflow-hidden ${textClass}`}
      data-widget={widget.i}
      style={{
        gridColumn: `${widget.x + 1} / span ${widget.w}`,
        gridRow: `${widget.y + 1} / span ${widget.h}`,
        ...widgetStyle,
      }}
    >
      <WidgetBgOverrideProvider value={background}>
        <div className="h-full w-full overflow-hidden" style={contentStyle}>
          {renderWidget(widget)}
        </div>
      </WidgetBgOverrideProvider>
    </div>
  );
});

/**
 * Pure CSS Grid display for dashboard widgets. SSR-safe.
 * No drag/resize — used only for display mode and screensaver.
 */
export function CssGridDisplay({
  layout,
  renderWidget,
  widgetRevisions,
  margin = 8,
  containerPadding = 12,
  cols = GRID_COLS,
  fillHeight = false,
  headerOffset = 140,
  bottomOffset = 0,
  minVisibleRows = 0,
  className,
}: CssGridDisplayProps) {
  const { containerRef, cellSize } = useSquareCells(cols, containerPadding, margin, fillHeight);

  const visibleWidgets = useMemo(
    () => layout.filter(w => w.visible !== false),
    [layout],
  );

  // Compute how many rows fit in the viewport (for fixed-height container)
  const visibleRows = useMemo(() => {
    if (fillHeight) return 12;
    if (typeof window === 'undefined') return 24;
    const availableHeight = window.innerHeight - headerOffset - bottomOffset;
    return Math.max(minVisibleRows, Math.floor((availableHeight + margin) / (cellSize + margin)));
  }, [fillHeight, cellSize, margin, headerOffset, bottomOffset, minVisibleRows]);

  const containerHeight = fillHeight
    ? '100%'
    : visibleRows * (cellSize + margin) + 2 * containerPadding;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className || ''}`}
      style={{ height: containerHeight }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridAutoRows: `${cellSize}px`,
          gap: `${margin}px`,
          padding: `${containerPadding}px`,
          height: '100%',
        }}
      >
        {visibleWidgets.map(widget => (
          <WidgetCell
            key={widget.i}
            widget={widget}
            renderWidget={renderWidget}
            revision={widgetRevisions?.[widget.i]}
          />
        ))}
      </div>
    </div>
  );
}
