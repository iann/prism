/**
 *
 * Provides a standardized container for dashboard widgets.
 * All widgets (Clock, Weather, Calendar, Tasks, etc.) use this as their shell.
 *
 * FEATURES:
 * - Consistent styling across all widgets
 * - Header with title and optional actions
 * - Loading and error states
 * - Expandable to full screen
 * - Touch-friendly interactions
 *
 * DESIGN PHILOSOPHY:
 * - Widgets should feel like "cards" on a dashboard
 * - Each widget can show its own loading/error states
 * - Optional header for widgets that need titles
 * - Content area fills available space
 *
 * USAGE:
 *   <WidgetContainer title="Weather" icon={<CloudIcon />}>
 *     <WeatherContent />
 *   </WidgetContainer>
 *
 *   <WidgetContainer
 *     title="Tasks"
 *     actions={<Button size="icon"><PlusIcon /></Button>}
 *     loading={isLoading}
 *   >
 *     <TaskList tasks={tasks} />
 *   </WidgetContainer>
 *
 */

'use client';

import * as React from 'react';
import { Emoji } from '@/components/ui/Emoji';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import {
  colorContrastRatio,
  contrastText,
  isLightColor,
  hexToHslValues,
  hexToRgba,
  parseHexColor,
} from '@/lib/utils/color';

/**
 * WIDGET ALIGNMENT
 */
export type HAlign = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'middle' | 'bottom';

export interface WidgetAlignment {
  horizontal: HAlign;
  vertical: VAlign;
}

const ALIGNMENT_STORAGE_KEY = 'prism-widget-alignments';

export function useWidgetAlignments() {
  const [alignments, setAlignmentsState] = React.useState<Record<string, WidgetAlignment>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem(ALIGNMENT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const setAlignment = React.useCallback((widgetId: string, alignment: WidgetAlignment) => {
    setAlignmentsState((prev) => {
      const next = { ...prev, [widgetId]: alignment };
      localStorage.setItem(ALIGNMENT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { alignments, setAlignment };
}

// Context for passing alignment to WidgetContainer without threading through every widget
const WidgetAlignmentContext = React.createContext<Record<string, WidgetAlignment>>({});
export const WidgetAlignmentProvider = WidgetAlignmentContext.Provider;

// Context for grid-level styling overrides. The outer grid cell owns customized
// background/border/radius/shadow chrome; WidgetContainer strips only the
// duplicate pieces and keeps semantic tokens synchronized with the resolved colors.
export type WidgetBgOverrideValue = {
  hasCustomBg: boolean;
  hasCustomShell?: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
  textColor?: string;
  textOpacity?: number;
  gridLineOpacity?: number;
  cellBackgroundColor?: string;
  cellBackgroundOpacity?: number;
};

const WidgetBgOverrideContext = React.createContext<WidgetBgOverrideValue | null>(null);
export const WidgetBgOverrideProvider = WidgetBgOverrideContext.Provider;

/** Hook for sub-components (e.g. calendar views) to check if widget has custom bg */
export function useWidgetBgOverride() {
  return React.useContext(WidgetBgOverrideContext);
}

// Context for current widget ID so WidgetContainer can self-lookup
const WidgetIdContext = React.createContext<string | null>(null);
export const WidgetIdProvider = WidgetIdContext.Provider;

const hAlignClass: Record<HAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const vAlignClass: Record<VAlign, string> = {
  top: 'justify-start',
  middle: 'justify-center',
  bottom: 'justify-end',
};

/**
 * Mix two opaque hex colors and return a CSS-safe opaque hex value. Keeping
 * derived semantic tokens opaque lets Tailwind opacity modifiers such as
 * `border-border/40` compose without producing a double-alpha declaration.
 */
function mixHexColors(background: string, foreground: string, foregroundWeight: number): string {
  const bg = parseHexColor(background) ?? parseHexColor('#000000')!;
  const fg = parseHexColor(foreground) ?? parseHexColor('#FFFFFF')!;
  const weight = Math.max(0, Math.min(1, foregroundWeight));
  const channel = (back: number, front: number) =>
    Math.round(back * (1 - weight) + front * weight)
      .toString(16)
      .padStart(2, '0');

  return `#${channel(bg.r, fg.r)}${channel(bg.g, fg.g)}${channel(bg.b, fg.b)}`;
}

function readableTodayColor(background: string, foreground: string): string {
  for (const weight of [0.12, 0.08, 0.04]) {
    const candidate = mixHexColors(background, foreground, weight);
    if (colorContrastRatio(foreground, candidate) >= 4.5) return candidate;
  }
  return mixHexColors(background, foreground, 0);
}

/** Find the lightest visual blend that reaches the requested contrast. */
function contrastMixColor(
  background: string,
  foreground: string,
  minimumContrast: number,
  strength = 1
): string {
  let requiredWeight = 1;
  for (let step = 1; step <= 20; step += 1) {
    const weight = step / 20;
    const candidate = mixHexColors(background, foreground, weight);
    if (colorContrastRatio(candidate, background) >= minimumContrast) {
      requiredWeight = weight;
      break;
    }
  }
  return mixHexColors(background, foreground, requiredWeight * Math.max(0, Math.min(1, strength)));
}

/**
 * WIDGET SIZE
 * Widgets can be different sizes on the dashboard grid.
 * These map to grid column/row spans.
 */
export type WidgetSize = 'small' | 'medium' | 'large' | 'wide' | 'tall';

/**
 * WIDGET CONTAINER PROPS
 */
export interface WidgetContainerProps {
  /** Widget title (shown in header) */
  title?: string;
  /** Stable widget identifier for tests/analytics. Falls back to title. */
  widgetType?: string;
  /** URL to navigate to when title is clicked */
  titleHref?: string;
  /** Icon to show before title */
  icon?: React.ReactNode;
  /** Action buttons for the header (e.g., add, refresh) */
  actions?: React.ReactNode;
  /** Widget content */
  children: React.ReactNode;
  /** Whether the widget is loading data */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Size variant for grid layout */
  size?: WidgetSize;
  /** Whether to show the header */
  showHeader?: boolean;
  /** Custom background color (hex). Auto-detects text color from luminance. */
  backgroundColor?: string;
  /** Widget ID for per-widget alignment lookup */
  widgetId?: string;
  /** Text alignment override */
  alignment?: WidgetAlignment;
  /** Additional CSS classes */
  className?: string;
  /** Click handler for the entire widget */
  onClick?: () => void;
}

/**
 * WIDGET CONTAINER COMPONENT
 * The main container component for all dashboard widgets.
 *
 * @example Basic widget
 * <WidgetContainer title="Clock">
 *   <ClockDisplay />
 * </WidgetContainer>
 *
 * @example Widget with actions
 * <WidgetContainer
 *   title="Tasks"
 *   icon={<CheckSquareIcon />}
 *   actions={
 *     <Button size="icon" variant="ghost">
 *       <PlusIcon />
 *     </Button>
 *   }
 * >
 *   <TaskList />
 * </WidgetContainer>
 *
 * @example Loading state
 * <WidgetContainer title="Weather" loading={true}>
 *   <WeatherContent />
 * </WidgetContainer>
 */
export function WidgetContainer({
  title,
  titleHref,
  icon,
  actions,
  children,
  loading = false,
  error = null,
  backgroundColor,
  size = 'medium',
  showHeader = true,
  widgetId,
  widgetType,
  alignment: alignmentProp,
  className,
  onClick,
}: WidgetContainerProps) {
  // Resolve alignment from prop, context, or default
  const contextAlignments = React.useContext(WidgetAlignmentContext);
  const contextWidgetId = React.useContext(WidgetIdContext);
  const resolvedId = widgetId || contextWidgetId;
  const alignment = alignmentProp || (resolvedId ? contextAlignments[resolvedId] : undefined);

  // When grid-level chrome is applied, strip the Card pieces now owned by the
  // outer cell. An outline-only override keeps the preset Card background.
  const bgOverride = React.useContext(WidgetBgOverrideContext);
  const stripCardBg = bgOverride?.hasCustomBg === true;
  const stripCardChrome = bgOverride?.hasCustomShell ?? stripCardBg;
  const customBackgroundColor = bgOverride?.backgroundColor ?? backgroundColor;
  const customBackgroundOpacity = bgOverride?.backgroundOpacity ?? 1;
  const hasOpaqueOverrideBackground =
    !!bgOverride?.backgroundColor &&
    bgOverride.backgroundColor !== 'transparent' &&
    bgOverride.backgroundColor !== 'frosted' &&
    customBackgroundOpacity >= 1 &&
    parseHexColor(bgOverride.backgroundColor)?.a === 1;
  // Text-only, transparent, and frosted overrides inherit the active theme.
  // Older layouts commonly persisted #FFFFFF here for wallpaper displays;
  // treating that as authoritative made light themes render black scrims.
  const overrideTextColor = hasOpaqueOverrideBackground ? bgOverride?.textColor : undefined;
  const overrideTextOpacity = bgOverride?.textOpacity ?? 1;
  const overrideGridLineOpacity = bgOverride?.gridLineOpacity ?? 1;

  // Size classes for the grid
  const sizeClasses: Record<WidgetSize, string> = {
    small: 'col-span-1 row-span-1',
    medium: 'col-span-1 row-span-2',
    large: 'col-span-2 row-span-2',
    wide: 'col-span-2 row-span-1',
    tall: 'col-span-1 row-span-3',
  };

  return (
    <Card
      className={cn(
        'wall-widget-container',
        // Grid sizing
        sizeClasses[size],
        // Full height within grid cell
        'h-full',
        // Grid layout: header gets auto height, content gets remaining space
        // (CSS Grid gives the content row a definite height, enabling ScrollArea h-full)
        'grid overflow-hidden',
        // Interactive cursor if clickable
        onClick && 'cursor-pointer transition-shadow hover:shadow-md',
        // Strip Card styling already supplied by the customized grid shell.
        stripCardBg && 'backdrop-blur-none',
        stripCardChrome && 'border-transparent shadow-none',
        // Direct-use fallback; grid-rendered widgets receive their resolved color via context.
        !overrideTextColor &&
          backgroundColor &&
          (isLightColor(backgroundColor) ? 'text-black' : 'text-white'),
        className
      )}
      onClick={onClick}
      data-widget={widgetType ?? title}
      data-theme-surface={stripCardBg || !!overrideTextColor || !!backgroundColor ? 'custom' : 'preset'}
      style={{
        // Grid rows: auto for header (if present), 1fr for content
        gridTemplateRows: showHeader && title ? 'auto 1fr' : '1fr',
        ...(stripCardBg
          ? { backgroundColor: 'transparent' }
          : backgroundColor
            ? { backgroundColor }
            : {}),
        ...(() => {
          // Two override surfaces, applied INDEPENDENTLY:
          //
          //   (1) Widget has its own backgroundColor — inner BG tokens
          //       (--card, --muted, --secondary, --background, --popover)
          //       inherit it so grid cells, hour column, date row,
          //       toolbar buttons all read as the same surface as the
          //       widget chrome. Fires WHETHER OR NOT textColor is also
          //       overridden (the user's case in this PR: they set a BG
          //       but kept default text and were still seeing white
          //       inner surfaces because the override block used to be
          //       gated on textColor).
          //
          //   (2) Widget has a textColor without an opaque background. The
          //       active theme owns that foreground and its preset/frosted
          //       surface; stale wallpaper colors are intentionally ignored.
          //
          // The two paths compose: BG override sets inner surface, text
          // override sets foreground colors. Hover (--accent) gets a
          // faint text-color tint when one is set, falls back to a
          // theme-anchored low-alpha when neither is.
          const hasSolidWidgetBg =
            !!customBackgroundColor &&
            customBackgroundColor !== 'transparent' &&
            customBackgroundColor !== 'frosted' &&
            customBackgroundOpacity >= 1 &&
            parseHexColor(customBackgroundColor)?.a === 1;

          // Grid adapters resolve persisted overrides before they reach this
          // component. Keep the direct backgroundColor prop safe as well.
          const effectiveTextColor =
            overrideTextColor ??
            (hasSolidWidgetBg ? contrastText(customBackgroundColor) : undefined);

          if (!effectiveTextColor && !hasSolidWidgetBg) return {};

          const styles: Record<string, string> = {};

          // ---- Text-color side ----
          let textHsl: string | null = null;
          let textIsLight = false;
          if (effectiveTextColor) {
            textHsl = hexToHslValues(effectiveTextColor);
            textIsLight = isLightColor(effectiveTextColor);
            styles.color =
              overrideTextOpacity < 1
                ? hexToRgba(effectiveTextColor, overrideTextOpacity)
                : effectiveTextColor;
            styles['--foreground'] = textHsl;
            styles['--card-foreground'] = textHsl;
            styles['--popover-foreground'] = textHsl;
            styles['--secondary-foreground'] = textHsl;
            styles['--accent-foreground'] = textHsl;
            styles['--seasonal-accent'] = textHsl;

            // Solid custom surfaces need boundaries derived from the resolved
            // foreground, but full-strength text-colored lines are visually
            // harsh. Transparent/frosted/text-only overrides retain the
            // palette's semantic --border and --input values.
            if (hasSolidWidgetBg) {
              const requestedStrength = Math.max(0, Math.min(1, overrideGridLineOpacity));
              styles['--border'] = hexToHslValues(
                contrastMixColor(customBackgroundColor!, effectiveTextColor, 3, requestedStrength)
              );
              styles['--input'] = hexToHslValues(
                contrastMixColor(customBackgroundColor!, effectiveTextColor, 3.5, requestedStrength)
              );
            }
          }

          // ---- Inner-BG side ----
          if (hasSolidWidgetBg) {
            const widgetHsl = hexToHslValues(customBackgroundColor!);
            const accentHex = mixHexColors(customBackgroundColor!, effectiveTextColor!, 0.12);
            styles['--card'] = widgetHsl;
            styles['--popover'] = widgetHsl;
            styles['--muted'] = widgetHsl;
            styles['--secondary'] = widgetHsl;
            styles['--background'] = widgetHsl;
            styles['--accent'] = hexToHslValues(accentHex);
            styles['--muted-foreground'] = hexToHslValues(
              contrastMixColor(customBackgroundColor!, effectiveTextColor!, 4.5)
            );
            styles['--calendar-surface'] = widgetHsl;
            styles['--calendar-today'] = hexToHslValues(
              readableTodayColor(customBackgroundColor!, effectiveTextColor!)
            );
          }

          return styles as unknown as React.CSSProperties;
        })(),
      }}
    >
      {/* WIDGET HEADER */}
      {showHeader && title && (
        <CardHeader className="wall-widget-header flex flex-shrink-0 flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            {/* Icon */}
            {icon && <span className="text-seasonal-accent">{icon}</span>}
            {/* Title - clickable link if titleHref provided */}
            {titleHref ? (
              <Link href={titleHref} prefetch={false} className="hover:underline">
                <CardTitle className="wall-widget-title text-lg font-semibold tracking-[-0.01em]">{title}</CardTitle>
              </Link>
            ) : (
              <CardTitle className="wall-widget-title text-lg font-semibold tracking-[-0.01em]">{title}</CardTitle>
            )}
          </div>
          {/* Action buttons */}
          {actions && <div className="flex items-center gap-1">{actions}</div>}
        </CardHeader>
      )}

      {/* WIDGET CONTENT */}
      <CardContent
        className={cn(
          'wall-widget-content',
          // Fill remaining space; min-h-0 prevents grid row overflow
          'flex min-h-0 flex-col',
          // Clip content overflow (individual widgets use ScrollArea for scrolling)
          'overflow-hidden',
          // Remove padding if no header
          !showHeader && 'pt-4',
          // Per-widget alignment
          alignment && hAlignClass[alignment.horizontal],
          alignment && vAlignClass[alignment.vertical]
        )}
      >
        {/* Loading State */}
        {loading && <WidgetLoading />}

        {/* Error State */}
        {error && !loading && <WidgetError message={error} />}

        {/* Normal Content */}
        {!loading && !error && children}
      </CardContent>
    </Card>
  );
}

/**
 * WIDGET LOADING
 * Loading indicator shown while widget data is being fetched.
 * Uses a skeleton/shimmer effect for a polished feel.
 */
function WidgetLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-full space-y-3">
        {/* Skeleton lines */}
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

/**
 * WIDGET ERROR
 * Error state shown when widget fails to load.
 * Shows a friendly message and suggests retry.
 */
function WidgetError({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
      <div className="mb-2 text-4xl text-destructive"><Emoji e="⚠️" /></div>
      <p className="max-w-[28rem] text-base leading-6 text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * WIDGET EMPTY
 * Empty state shown when widget has no data.
 * Can be used inside widgets for their empty states.
 *
 * @example
 * {tasks.length === 0 ? (
 *   <WidgetEmpty
 *     icon={<CheckCircleIcon />}
 *     message="No tasks for today"
 *     action={<Button>Add Task</Button>}
 *   />
 * ) : (
 *   <TaskList tasks={tasks} />
 * )}
 */
export function WidgetEmpty({
  icon,
  message,
  action,
}: {
  icon?: React.ReactNode;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center">
      {icon && <div className="text-4xl text-muted-foreground">{icon}</div>}
      <p className="max-w-[28rem] text-base leading-6 text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
