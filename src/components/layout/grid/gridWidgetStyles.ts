import type { CSSProperties } from 'react';
import { colorContrastRatio, contrastText, hexToRgba, parseHexColor } from '@/lib/utils/color';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

const MIN_TEXT_CONTRAST = 4.5;

/** Shared chrome applied by the grid when it owns a customized widget shell. */
export const CUSTOM_WIDGET_SHELL_CLASS = 'rounded-[1.5rem] border-0 shadow-none';

export function hasCustomWidgetShell(w: WidgetConfig): boolean {
  return !!w.backgroundColor || !!w.outlineColor;
}

function hasSolidWidgetBackground(
  w: WidgetConfig
): w is WidgetConfig & { backgroundColor: string } {
  return (
    !!w.backgroundColor &&
    w.backgroundColor !== 'transparent' &&
    w.backgroundColor !== 'frosted' &&
    (w.backgroundOpacity ?? 1) >= 1 &&
    parseHexColor(w.backgroundColor)?.a === 1
  );
}

/**
 * Resolve the text color that is actually safe to render on a widget.
 * Explicit colors are authoritative only when the widget also owns an opaque
 * solid surface. Text-only, transparent, and frosted overrides defer to the
 * active theme foreground; persisted white text from an older wallpaper
 * layout must not turn a light theme into a dark card.
 */
export function getEffectiveWidgetTextColor(w: WidgetConfig): string | undefined {
  if (!hasSolidWidgetBackground(w)) return undefined;

  if (w.textColor && colorContrastRatio(w.textColor, w.backgroundColor) >= MIN_TEXT_CONTRAST) {
    return w.textColor;
  }

  return contrastText(w.backgroundColor);
}

/**
 * Compute inline CSSProperties for a widget's background, outline, and text
 * color. Used by both CssGridDisplay and the editor. Text-only overrides are
 * intentionally omitted so the active theme owns preset/frosted surfaces.
 *
 * NOTE: `textScale` (zoom) is intentionally NOT included here anymore — it
 * lives in `getWidgetContentStyle` so it can be applied on the inner content
 * wrapper, NOT the grid-cell wrapper. Applying `zoom` to a CSS grid cell
 * sporadically fails to propagate into the rendered subtree on the
 * dashboard render path (visible bug: dashboard weather widget ignored
 * its textScale even though the screensaver's identical code path
 * honored it). Moving the zoom inward isolates it from the grid layout
 * algorithm and makes scaling deterministic across both views.
 */
export function getWidgetStyle(w: WidgetConfig): CSSProperties | undefined {
  const hasCustomShell = hasCustomWidgetShell(w);
  const textColor = getEffectiveWidgetTextColor(w);
  if (!hasCustomShell && !textColor) return undefined;

  const style: CSSProperties = {};

  if (hasCustomShell) {
    // Match the shared Card's rounded-xl, one-pixel semantic boundary. The
    // grid wrapper owns this chrome while WidgetContainer strips its duplicate.
    style.borderRadius = '1.5rem';
    style.borderWidth = '0px';
    style.borderStyle = 'solid';
    style.borderColor = 'transparent';
  }

  if (w.backgroundColor === 'frosted') {
    // Blur intensity mapped from backgroundOpacity: 0.25=light, 0.5=med, 0.75=heavy, 1=max
    const intensity = w.backgroundOpacity ?? 0.5;
    const blurPx = Math.round(intensity * 24); // 6px to 24px
    const tintOpacity = 0.08 + intensity * 0.12; // 0.08 to 0.20
    style.backgroundColor = `rgba(255,255,255,${tintOpacity})`;
    style.backdropFilter = `blur(${blurPx}px) saturate(${1 + intensity * 0.3})`;
    (style as Record<string, string>).WebkitBackdropFilter =
      `blur(${blurPx}px) saturate(${1 + intensity * 0.3})`;
  } else if (w.backgroundColor && w.backgroundColor !== 'transparent') {
    const opacity = w.backgroundOpacity ?? 1;
    style.backgroundColor = opacity < 1 ? hexToRgba(w.backgroundColor, opacity) : w.backgroundColor;
  }

  if (w.outlineColor) {
    const olOpacity = w.outlineOpacity ?? 1;
    style.borderColor = olOpacity < 1 ? hexToRgba(w.outlineColor, olOpacity) : w.outlineColor;
  }

  if (textColor) {
    const txtOpacity = w.textOpacity ?? 1;
    style.color = txtOpacity < 1 ? hexToRgba(textColor, txtOpacity) : textColor;
  }

  return style;
}

/**
 * Style applied to the INSIDE wrapper of a widget cell (not the grid
 * cell itself). Currently just `zoom: textScale` — see getWidgetStyle for
 * the reason this is separated out.
 */
export function getWidgetContentStyle(w: WidgetConfig): CSSProperties | undefined {
  if (!w.textScale || w.textScale === 1) return undefined;
  // Tailwind text classes use rem (root-relative), which ignores parent
  // em/font-size — `zoom` scales everything (rem text, SVG dimensions,
  // layout boxes) proportionally without changing the cell's grid slot.
  return { zoom: w.textScale } as CSSProperties;
}

/**
 * Get a Tailwind text color class based on widget background luminance.
 * Returns empty when the resolved text color is applied inline via context or
 * when the active theme should supply the foreground.
 */
export function getTextColorClass(w: WidgetConfig, fallback = ''): string {
  return getEffectiveWidgetTextColor(w) ? '' : fallback;
}
