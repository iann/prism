/**
 *
 * Provides a persistent side navigation bar that appears on all pages.
 * The nav includes links to all main sections and user profile controls.
 *
 * FEATURES:
 * - Collapsible design (icons only or expanded with text)
 * - Active page highlighting
 * - User avatar with logout option at bottom
 * - Touch-optimized for tablets
 * - Remembers collapsed/expanded state
 * - Smooth transitions
 *
 * USAGE:
 *   <SideNav
 *     currentPath="/calendar"
 *     user={currentUser}
 *     onLogout={() => handleLogout()}
 *   />
 *
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PrismIcon } from '@/components/ui/PrismIcon';
import { ALL_NAV_ITEMS } from '@/lib/constants/navItems';
import { useHiddenPages } from '@/lib/hooks/useHiddenPages';
import { FamilyAvatar, WallNavItem } from '@/components/wall';

const WALL_NAV_ACCENTS = [
  '#e28b77',
  '#6eaa98',
  '#e5b654',
  '#7ea9c7',
  '#a18dc8',
  '#dc8ea7',
  '#53a69f',
] as const;

/**
 * SIDE NAV PROPS
 */
export interface SideNavProps {
  /** Current user information */
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    color?: string;
  } | null;
  /** Callback when logout is clicked */
  onLogout?: () => void;
  /** Callback when login is clicked (when no user) */
  onLogin?: () => void;
  /** Whether auto-hide has hidden the UI */
  uiHidden?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SIDE NAV COMPONENT
 * The main side navigation component.
 *
 * RESPONSIVE BEHAVIOR:
 * - Desktop: Always visible, can collapse/expand
 * - Mobile: Hidden by default, shows via hamburger menu
 *
 * STATE MANAGEMENT:
 * - Collapsed state saved to localStorage
 * - Mobile menu state tracked separately
 *
 * @example
 * <SideNav
 *   user={currentUser}
 *   onLogout={() => setCurrentUser(null)}
 * />
 */
export function SideNav({ user, onLogout, onLogin, uiHidden, className }: SideNavProps) {
  // Get current pathname for active state
  const pathname = usePathname();
  const { filterNavItems } = useHiddenPages();
  const navItems = filterNavItems(ALL_NAV_ITEMS);
  const [expanded, setExpanded] = React.useState(false);
  const asideRef = React.useRef<HTMLElement>(null);

  // Close drawer when clicking outside
  React.useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [expanded]);

  // Collapse on navigation
  React.useEffect(() => {
    setExpanded(false);
  }, [pathname]);

  // Check if a nav item is active
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  // Toggle drawer on tap in blank area — skip if clicking a link or button
  const handleAsideClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('a') || target.closest('button')) return;
    setExpanded((prev) => !prev);
  };

  return (
    <>
      {/* SIDE NAVIGATION - visibility controlled by AppShell based on orientation */}
      <aside
        ref={asideRef}
        onClick={handleAsideClick}
        className={cn(
          'wall-side-nav',
          'fixed left-0 top-0 z-40 h-screen',
          'bg-card dark:bg-card/95',
          'flex flex-col',
          'transition-[transform,opacity,width] duration-300 ease-in-out',
          expanded && 'wall-side-nav-expanded',
          expanded ? 'w-52 shadow-xl' : 'w-16',
          uiHidden ? '-translate-x-full opacity-0 delay-100' : 'translate-x-0 opacity-100 delay-0',
          className
        )}
      >
        {/* HEADER WITH LOGO */}
        <div
          className={cn(
            'flex h-20 items-center px-2',
            expanded ? 'justify-start px-4' : 'justify-center'
          )}
        >
          <Link
            href="/"
            prefetch={false}
            className="flex items-center gap-2"
            aria-label="Prism home"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[hsl(var(--wall-surface-raised))]">
              <PrismIcon size={28} />
            </div>
            {expanded && <span className="text-lg font-bold tracking-tight">Prism</span>}
          </Link>
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="flex-1 overflow-y-auto py-3">
          <ul className={cn('space-y-2 px-2', expanded && 'px-3')}>
            {navItems.map((item, index) => (
              <li key={item.href}>
                <WallNavItem
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isActive(item.href)}
                  expanded={expanded}
                  accent={WALL_NAV_ACCENTS[index % WALL_NAV_ACCENTS.length]}
                />
              </li>
            ))}
          </ul>
        </nav>

        {/* HELP LINK */}
        <div className={cn('px-2 pb-2', expanded ? 'px-3' : 'text-center')}>
          <WallNavItem
            href="/help"
            label="Help"
            icon={HelpCircle}
            expanded={expanded}
            accent="#7ea9c7"
          />
        </div>

        {/* USER AVATAR AT BOTTOM */}
        <div className="p-2">
          <button
            onClick={user ? onLogout : onLogin}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-1.5 [@media(pointer:coarse)]:py-2.5',
              'text-sm font-medium',
              'transition-colors duration-200',
              'touch-target',
              'wall-user-button text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              expanded ? 'justify-start px-3' : 'justify-center'
            )}
            aria-label={user ? 'Log out' : 'Log in'}
          >
            {user ? (
              <>
                <FamilyAvatar
                  name={user.name}
                  color={user.color}
                  imageUrl={user.avatarUrl}
                  size="md"
                />
                {expanded && <span className="truncate whitespace-nowrap">{user.name}</span>}
              </>
            ) : (
              <>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--wall-surface-muted))]">
                  <UserRound className="h-5 w-5" />
                </div>
                {expanded && <span className="whitespace-nowrap">Log in</span>}
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
