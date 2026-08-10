/**
 *
 * Provides the main grid layout for organizing widgets on the dashboard.
 * Widgets are arranged in a responsive CSS grid.
 *
 * GRID SYSTEM:
 * The dashboard uses a 4-column grid (on desktop) that adapts to screen size:
 * - Desktop (1920x1080): 4 columns
 * - Tablet: 2-3 columns
 * - Mobile: 1-2 columns
 *
 * WIDGET SIZES:
 * Widgets can span multiple columns/rows:
 * - small:  1x1 (single cell)
 * - medium: 1x2 (one column, two rows)
 * - large:  2x2 (two columns, two rows)
 * - wide:   2x1 (two columns, one row)
 * - tall:   1x3 (one column, three rows)
 *
 * USAGE:
 *   <DashboardGrid>
 *     <ClockWidget />
 *     <WeatherWidget />
 *     <CalendarWidget />
 *     <TasksWidget />
 *   </DashboardGrid>
 *
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { AwayModeToggle } from '@/components/away-mode';
import { BabysitterModeToggle } from '@/components/babysitter-mode';
import { PerformanceModeBadge } from '@/components/layout/PerformanceModeBadge';
import { useAutoHideUI } from '@/lib/hooks/useAutoHideUI';
import { RefreshCw } from 'lucide-react';

/**
 * DASHBOARD GRID PROPS
 */
export interface DashboardGridProps {
  /** Widget components to arrange in the grid */
  children: React.ReactNode;
  /** Number of columns (default: 4) */
  columns?: 2 | 3 | 4;
  /** Gap between widgets in pixels */
  gap?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * DASHBOARD GRID COMPONENT
 * The main container that arranges widgets in a responsive grid.
 *
 * RESPONSIVE BEHAVIOR:
 * - On large screens: Shows full grid (default 4 columns)
 * - On tablets: Reduces to 2-3 columns
 * - On mobile: Single column stack
 *
 * GRID SIZING:
 * - Uses CSS Grid with auto-fill for rows
 * - Each row is 200px by default (configurable)
 * - Widgets can span multiple cells using grid-column/grid-row
 *
 * @example Basic usage
 * <DashboardGrid>
 *   <ClockWidget />
 *   <WeatherWidget />
 *   <CalendarWidget />
 * </DashboardGrid>
 *
 * @example Custom columns
 * <DashboardGrid columns={3}>
 *   {widgets}
 * </DashboardGrid>
 */
export function DashboardGrid({ children, columns = 4, gap = 16, className }: DashboardGridProps) {
  // Column configuration based on prop
  const columnClasses = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div
      className={cn(
        // Grid layout
        'grid',
        columnClasses[columns],
        // Auto-fill rows with minimum height
        'auto-rows-[200px]',
        // Full height of container
        'h-full w-full',
        // Padding around the grid
        'p-4',
        className
      )}
      style={{ gap: `${gap}px` }}
    >
      {children}
    </div>
  );
}

/**
 * DASHBOARD LAYOUT
 * Full-page layout component that includes the dashboard grid
 * along with any header/navigation elements.
 *
 * STRUCTURE:
 * ┌────────────────────────────────────────┐
 * │  Header (optional)                      │
 * ├────────────────────────────────────────┤
 * │                                         │
 * │         Dashboard Grid                  │
 * │         (Widgets here)                  │
 * │                                         │
 * └────────────────────────────────────────┘
 *
 * @example
 * <DashboardLayout>
 *   <DashboardGrid>
 *     <ClockWidget />
 *     <WeatherWidget />
 *   </DashboardGrid>
 * </DashboardLayout>
 */
export function DashboardLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Full viewport
        'min-h-screen w-full',
        // Transparent background to allow wallpaper to show through
        // Flex column for header + content
        'flex flex-col',
        className
      )}
    >
      {/* Main content area is owned by AppShell; keep this wrapper non-semantic. */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * DASHBOARD HEADER PROPS
 */
export interface DashboardHeaderProps {
  /** Callback when edit layout button is clicked (parents only) */
  onEditClick?: () => void;
  /** Callback when screensaver button is clicked */
  onScreensaverClick?: () => void;
  /** Name of the currently selected saved dashboard */
  dashboardName?: string;
}

/**
 * DASHBOARD HEADER
 * Optional header bar for the dashboard.
 * Shows app name, greeting, user info, and quick actions.
 *
 * NOTE: For a wall-mounted display, you might want to hide this
 * to maximize space for widgets. It's optional.
 *
 * @example Basic
 * <DashboardHeader />
 *
 * @example With user
 * <DashboardHeader
 *   user={{ name: 'Alex', color: '#3B82F6' }}
 *   greeting="Good morning"
 *   onUserClick={() => logout()}
 * />
 */
export function DashboardHeader({
  onEditClick,
  onScreensaverClick,
  dashboardName,
}: DashboardHeaderProps) {
  const { uiHidden } = useAutoHideUI();
  const [measureHideChrome, setMeasureHideChrome] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      // Hide header when measure mode has hideNav on (showing "clean" view)
      setMeasureHideChrome(typeof d === 'boolean' ? d : d.active && d.hideNav);
    };
    window.addEventListener('prism:measure-mode', handler);
    return () => window.removeEventListener('prism:measure-mode', handler);
  }, []);

  const hidden = uiHidden || measureHideChrome;
  return (
    <header
      className={cn(
        'wall-dashboard-header',
        // 'relative z-10' is load-bearing: WallpaperBackground is fixed at z-0,
        // and without our own stacking context the toolbar would paint underneath
        // it whenever backdrop-blur is disabled (e.g. perf mode).
        'relative z-10 flex-shrink-0 overflow-hidden bg-card px-4 transition-all duration-500 ease-in-out dark:bg-card/95 dark:backdrop-blur-sm',
        hidden ? 'max-h-0 py-0 opacity-0' : 'max-h-20 py-2 delay-200'
      )}
    >
      <div className="flex w-full items-center justify-between gap-4">
        <div className="hidden items-center gap-3 md:flex">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-xl"
            aria-hidden
          >
            ✦
          </div>
          <div className="flex flex-col leading-tight">
            <span className="wall-dashboard-eyebrow text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {dashboardName || 'Family calendar'}
            </span>
            <span className="wall-dashboard-date text-xl font-bold tracking-tight">
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {onEditClick && (
            <button
              onClick={onEditClick}
              className="wall-header-action inline-flex min-h-11 items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent active:scale-[0.98]"
              aria-label="Customize dashboard"
              title="Customize dashboard"
            >
              <GridEditIcon />
              <span>Customize</span>
            </button>
          )}

          <button
            onClick={() => window.location.reload()}
            className="wall-header-action rounded-full p-2 transition-colors hover:bg-accent"
            aria-label="Refresh page"
            title="Refresh page"
          >
            <RefreshCw className="h-5 w-5" />
          </button>

          <PerformanceModeBadge />
          <BabysitterModeToggle />
          <AwayModeToggle />

          {onScreensaverClick && (
            <button
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onScreensaverClick();
              }}
              className="wall-header-action rounded-full p-2 transition-colors hover:bg-accent"
              aria-label="Start screensaver"
              title="Start screensaver"
            >
              <ScreensaverIcon />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Grid edit icon for layout customization
 */
function GridEditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

/**
 * Screensaver icon (lamp / nightlight)
 */
function ScreensaverIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2h8l4 10H4L8 2Z" />
      <path d="M12 12v6" />
      <path d="M8 18h8" />
    </svg>
  );
}
