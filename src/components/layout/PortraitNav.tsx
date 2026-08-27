/**
 * Portrait Bottom Navigation
 *
 * A bottom navigation bar for portrait mode on web (tablets/desktop).
 * Shows selected routes in a compact row, with horizontal scrolling when
 * the chosen set is wider than the available display.
 */

'use client';
import { Emoji } from '@/components/ui/Emoji';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { ALL_NAV_ITEMS } from '@/lib/constants/navItems';
import { useHiddenPages } from '@/lib/hooks/useHiddenPages';
import { contrastText } from '@/lib/utils/color';

export interface PortraitNavProps {
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    color?: string;
  } | null;
  onLogin?: () => void;
  onLogout?: () => void;
  uiHidden?: boolean;
}

export function PortraitNav({ user, onLogin, onLogout, uiHidden }: PortraitNavProps) {
  const pathname = usePathname();
  const { filterPortraitNavItems } = useHiddenPages();
  const navItems = filterPortraitNavItems(ALL_NAV_ITEMS);
  const t = useTranslations('common');

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className={cn(
      'wall-portrait-nav',
      'fixed bottom-0 left-0 right-0 bg-card dark:bg-card/95 border-t border-border z-40 safe-area-bottom',
      'transition-[transform,opacity] duration-300 ease-in-out',
      uiHidden ? 'translate-y-full opacity-0 delay-100' : 'translate-y-0 opacity-100 delay-0'
    )} aria-label="Portrait navigation">
      <div className="wall-portrait-nav-items flex items-center justify-start h-20 min-w-0 max-w-full gap-1 overflow-x-auto overflow-y-hidden px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                'wall-portrait-nav-item',
                active && 'wall-portrait-nav-item-active',
                'flex min-w-[78px] max-w-[7.5rem] flex-1 flex-col items-center gap-1 py-2 px-2 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-7 w-7 shrink-0', active && 'stroke-[2.5]')} />
              <span className="max-w-full truncate text-xs font-medium">{t(item.i18nKey)}</span>
            </Link>
          );
        })}

        {/* User/Login button */}
        <button
          onClick={user ? onLogout : onLogin}
          className={cn(
            'wall-portrait-nav-item wall-portrait-nav-item-user',
            'flex min-w-[78px] max-w-[7.5rem] flex-1 flex-col items-center gap-1 py-2 px-2 transition-colors',
            'text-muted-foreground hover:text-foreground'
          )}
          aria-label={user ? 'Log out' : 'Log in'}
        >
          {user ? (
            <>
              <div
                className="relative h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: user.color || '#6B7280', color: contrastText(user.color || '#6B7280') }}
              >
                {user.avatarUrl?.startsWith('emoji:') ? (
                  <span className="text-base"><Emoji e={user.avatarUrl.slice(6)} /></span>
                ) : user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.name}
                    fill
                    unoptimized
                    className="rounded-full object-cover"
                  />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              <span className="max-w-full truncate text-xs font-medium">{user.name}</span>
            </>
          ) : (
            <>
              <User className="h-7 w-7 text-red-500" />
              <span className="text-xs font-medium text-red-500">Login</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
}
