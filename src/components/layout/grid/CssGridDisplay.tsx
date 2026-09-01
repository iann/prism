'use client';

import * as React from 'react';
import { memo, useEffect, useMemo } from 'react';
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
import { useViewportSize } from '@/lib/hooks/useViewportSize';
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

const noopRemeasure = () => {};

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
  rowHeightScale = 1,
  minVisibleRows = 0,
  targetRows,
  designOrientation,
  containMode = false,
  className,
}: CssGridDisplayProps) {
  const {
    containerRef,
    cellSize: widthCellSize,
    width = 0,
    top = 0,
    zoom = 1,
    remeasure = noopRemeasure,
  } = useSquareCells(cols, containerPadding, margin, fillHeight);
  const { width: viewportWidth, height: viewportHeight } = useViewportSize();

  useEffect(() => {
    remeasure();
  }, [headerOffset, bottomOffset, remeasure]);

  const visibleWidgets = useMemo(
    () => layout.filter(w => w.visible !== false),
    [layout],
  );

  // --- Fit-to-screen (targetRows set) --------------------------------------
  // The design is a fixed `cols × targetRows` canvas. How it maps onto the real
  // screen depends on whether the screen's orientation matches the design's:
  //   • SAME orientation (e.g. a landscape design on a landscape screen — the
  //     normal case): STRETCH both axes to fill. The layout always appears to
  //     fill the screen and nothing is clipped; widgets squish/elongate by only
  //     the small amount needed to absorb the aspect-ratio difference. This is
  //     what makes F11/fullscreen, a laptop browser, and a kiosk all look right.
  //   • OPPOSITE orientation (a portrait design on a landscape screen, or vice
  //     versa): a stretch would be a ~2× skew, so instead CONTAIN the canvas
  //     scaled-to-fit and letterbox it, preserving proportions.
  // The canvas we fit to the screen is the ACTUAL content bounding box (origin →
  // furthest used row/col), NOT the full guide. This is what makes the bottom
  // row and right column land on the screen edges: any trailing empty guide rows
  // the design didn't use are simply not part of the canvas, so they can't
  // become an awkward gap. Top/left margins the design left ARE preserved
  // (anchored at origin) and scale proportionally.
  const { fitCols, fitRows } = useMemo(() => {
    let maxCol = 1, maxRow = 1;
    for (const w of visibleWidgets) {
      if (w.x + w.w > maxCol) maxCol = w.x + w.w;
      if (w.y + w.h > maxRow) maxRow = w.y + w.h;
    }
    return { fitCols: maxCol, fitRows: maxRow };
  }, [visibleWidgets]);

  const fit = (!!targetRows || containMode) && !fillHeight;
  // Decide stretch-vs-letterbox from the CONTENT'S OWN SHAPE, not a stored
  // orientation label (which can drift from the actual widgets — e.g. a layout
  // saved as "portrait" but laid out landscape). A wide design on a wide screen
  // (or tall on tall) stretches to fill; a genuine orientation mismatch (wide
  // design on a tall screen or vice-versa) would be a ~2× skew, so it letterboxes
  // to preserve proportions. `designOrientation` is kept only as a fallback for
  // an empty/degenerate layout.
  const designWide = fitCols !== fitRows
    ? fitCols > fitRows
    : (designOrientation ? designOrientation === 'landscape' : true);
  const screenWide = viewportWidth >= viewportHeight;
  const sameOrientation = designWide === screenWide;
  // containMode always scales-to-fit (screensaver — sparse ambient layout that
  // should fit any screen without clipping); otherwise stretch when orientation
  // matches and letterbox only on a genuine mismatch.
  const stretch = fit && sameOrientation && !containMode;
  const contain = fit && (!sameOrientation || containMode);

  // Available box below the real chrome. Uses the measured grid top when we have
  // it (real header height) and the reactive viewport height so F11/fullscreen,
  // window resize and orientation change all re-fill automatically.
  //
  // BUT when the chrome is explicitly hidden (headerOffset 0 — auto-hide/kiosk),
  // trust that: the grid slides to the very top, yet the measured `top` only
  // re-reads on resize (a chrome hide is a position change, not a size change),
  // so it stays stale at ~56px and leaves ~1-2 empty rows at the bottom. When the
  // caller says the chrome is gone, the top is 0.
  // Take the LARGER of the measured grid-top and the caller's offset so we never
  // under-estimate the header (a taller touch-device header, or a not-yet-settled
  // measurement, used to let the bottom row clip). A small safety margin when
  // chrome is present absorbs any residual slop — better a hair of bottom gap
  // than a clipped row.
  // `top` is a getBoundingClientRect value (visual pixels) while the viewport
  // heights below are root pixels. Under a per-display font scale the dashboard
  // renders inside a `zoom` wrapper and those stop being the same unit, so the
  // grid budgeted its height unscaled and then drew it magnified — the bottom
  // of the dashboard ran off the screen, a whole widget at a time. Divide both
  // by the measured scale so the budget is computed in the grid's own space.
  // `zoom` is 1 on an unscaled display, so this is a no-op there.
  const localTop = top / zoom;
  const chromeTop = headerOffset <= 0 ? 0 : Math.max(localTop, headerOffset);
  // Some kiosk browsers over-report window.innerHeight vs the actually-visible
  // area (a device/browser bottom bar), which let the bottom row clip on a real
  // touch display even when the math looked right. Prefer the visual-viewport
  // height whenever it's smaller.
  const visualH = (typeof window !== 'undefined' && window.visualViewport)
    ? Math.min(viewportHeight, window.visualViewport.height)
    : viewportHeight;
  const localH = visualH / zoom;
  const bottomSafety = chromeTop > 0 ? Math.round(margin * 1.5) : 0;
  const availH = Math.max(120, localH - chromeTop - bottomOffset - bottomSafety);

  // Contain (letterbox) mode: largest square cell that fits the WHOLE content
  // canvas within the available box on both axes.
  const containCell = useMemo(() => {
    if (!contain || width <= 0) return widthCellSize;
    const innerW = width - 2 * containerPadding - (fitCols - 1) * margin;
    const innerH = availH - 2 * containerPadding - (fitRows - 1) * margin;
    return Math.max(8, Math.floor(Math.min(innerW / fitCols, innerH / fitRows)));
  }, [contain, width, availH, widthCellSize, fitCols, fitRows, containerPadding, margin]);

  // Legacy (no targetRows): fill width, adapt row count to the viewport.
  const legacyRows = useMemo(() => {
    if (fillHeight) return 12;
    if (viewportHeight <= 0) return 24;
    const available = viewportHeight / zoom - headerOffset - bottomOffset;
    const rowCellSize = Math.max(16, Math.round(widthCellSize * rowHeightScale));
    return Math.max(minVisibleRows, Math.floor((available + margin) / (rowCellSize + margin)));
  }, [
    fillHeight,
    viewportHeight,
    zoom,
    headerOffset,
    bottomOffset,
    minVisibleRows,
    widthCellSize,
    rowHeightScale,
    margin,
  ]);

  const rowCellSize = Math.max(16, Math.round(widthCellSize * rowHeightScale));
  const visibleRows = fit ? fitRows : legacyRows;

  let containerHeight: number | string;
  let centerContain = false;
  let gridStyle: React.CSSProperties;

  if (stretch) {
    containerHeight = availH;
    gridStyle = {
      display: 'grid',
      gridTemplateColumns: `repeat(${fitCols}, 1fr)`,
      gridTemplateRows: `repeat(${fitRows}, 1fr)`,
      gap: `${margin}px`,
      paddingTop: containerPadding,
      paddingRight: containerPadding,
      paddingBottom: containerPadding,
      paddingLeft: containerPadding + (screenWide ? 20 : 0),
      width: '100%',
      height: '100%',
    };
  } else if (contain) {
    containerHeight = availH;
    centerContain = true;
    gridStyle = {
      display: 'grid',
      gridTemplateColumns: `repeat(${fitCols}, ${containCell}px)`,
      gridAutoRows: `${containCell}px`,
      gap: `${margin}px`,
      padding: `${containerPadding}px`,
      width: fitCols * containCell + (fitCols - 1) * margin + 2 * containerPadding,
      height: fitRows * containCell + (fitRows - 1) * margin + 2 * containerPadding,
    };
  } else {
    containerHeight = fillHeight
      ? '100%'
      : legacyRows * rowCellSize + (legacyRows - 1) * margin + 2 * containerPadding;
    gridStyle = {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      gridAutoRows: `${rowCellSize}px`,
      gap: `${margin}px`,
      padding: `${containerPadding}px`,
      height: '100%',
    };
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className || ''}`}
      style={{
        height: containerHeight,
        ...(centerContain
          ? { display: 'flex', alignItems: 'center', justifyContent: 'center' }
          : {}),
      }}
    >
      <div style={gridStyle}>
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
