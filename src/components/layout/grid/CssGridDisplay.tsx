'use client';

import * as React from 'react';
import { memo, useMemo } from 'react';
import { WidgetBgOverrideProvider } from '@/components/widgets/WidgetContainer';
import {
  CUSTOM_WIDGET_SHELL_CLASS,
  getEffectiveWidgetTextColor,
  getWidgetStyle,
  getWidgetContentStyle,
  getTextColorClass,
  hasCustomWidgetShell,
} from './gridWidgetStyles';
import { useSquareCells } from './useSquareCells';
import { GRID_COLS } from '@/lib/constants/grid';
import type { CssGridDisplayProps } from './gridEditorTypes';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { getWidgetType } from '@/lib/utils/widgetInstances';

interface WidgetCellProps {
  widget: WidgetConfig;
  renderWidget: CssGridDisplayProps['renderWidget'];
  revision: unknown;
  initiallyVisible: boolean;
  deferOffscreen: boolean;
}

function DeferredWidget({
  widget,
  renderWidget,
  initiallyVisible,
  deferOffscreen,
  className,
  style,
}: {
  widget: WidgetConfig;
  renderWidget: CssGridDisplayProps['renderWidget'];
  initiallyVisible: boolean;
  deferOffscreen: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(!deferOffscreen || initiallyVisible);

  React.useEffect(() => {
    if (!deferOffscreen || initiallyVisible) {
      setIsVisible(true);
      return;
    }

    const element = contentRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      // Older embedded Chromium builds do not expose IntersectionObserver.
      // Rendering is the safe fallback for those displays.
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      // Render slightly before a widget reaches the viewport so a user does
      // not see a loading gap after a resize/orientation change.
      { rootMargin: '200px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [deferOffscreen, initiallyVisible]);

  return (
    <div ref={contentRef} className={className} style={style}>
      {isVisible ? renderWidget(widget) : null}
    </div>
  );
}

const WidgetCell = memo(function WidgetCell({
  widget,
  renderWidget,
  initiallyVisible,
  deferOffscreen,
}: WidgetCellProps) {
  const widgetStyle = getWidgetStyle(widget);
  const contentStyle = getWidgetContentStyle(widget);
  const textClass = getTextColorClass(widget);
  const hasCustomShell = hasCustomWidgetShell(widget);
  const effectiveTextColor = getEffectiveWidgetTextColor(widget);
  const background = {
    hasCustomBg: !!widget.backgroundColor,
    hasCustomShell,
    backgroundColor: widget.backgroundColor,
    backgroundOpacity: widget.backgroundOpacity,
    textColor: effectiveTextColor,
    textOpacity: widget.textOpacity,
    gridLineOpacity: widget.gridLineOpacity,
    cellBackgroundColor: widget.cellBackgroundColor,
    cellBackgroundOpacity: widget.cellBackgroundOpacity,
  };

  return (
    <div
      className={`widget-cell relative overflow-hidden ${hasCustomShell ? CUSTOM_WIDGET_SHELL_CLASS : ''} ${textClass}`}
      data-widget={getWidgetType(widget)}
      data-widget-instance={widget.i}
      style={{
        gridColumn: `${widget.x + 1} / span ${widget.w}`,
        gridRow: `${widget.y + 1} / span ${widget.h}`,
        // Let Chromium skip style/layout/paint work for the descendants of
        // cells that are outside the wall display. The React-level deferral
        // below also prevents their timers and data-dependent subtrees from
        // mounting in the first place.
        ...(deferOffscreen ? { contentVisibility: 'auto' as const } : {}),
        ...widgetStyle,
      }}
    >
      <WidgetBgOverrideProvider value={background}>
        <DeferredWidget
          widget={widget}
          renderWidget={renderWidget}
          initiallyVisible={initiallyVisible}
          deferOffscreen={deferOffscreen}
          className="h-full w-full overflow-hidden"
          style={contentStyle}
        />
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
  deferOffscreen = !fillHeight,
  headerOffset = 140,
  bottomOffset = 0,
  minVisibleRows = 0,
  className,
}: CssGridDisplayProps) {
  const { containerRef, cellSize } = useSquareCells(cols, containerPadding, margin, fillHeight);

  const visibleWidgets = useMemo(() => layout.filter((w) => w.visible !== false), [layout]);

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
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridAutoRows: `${cellSize}px`,
          gap: `${margin}px`,
          padding: `${containerPadding}px`,
          height: '100%',
        }}
      >
        {visibleWidgets.map((widget) => (
          <WidgetCell
            key={widget.i}
            widget={widget}
            renderWidget={renderWidget}
            revision={widgetRevisions?.[getWidgetType(widget)]}
            initiallyVisible={
              !deferOffscreen || (widget.y < visibleRows && widget.y + widget.h > 0)
            }
            deferOffscreen={deferOffscreen}
          />
        ))}
      </div>
    </div>
  );
}
