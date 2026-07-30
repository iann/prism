'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle, User } from 'lucide-react';
import { ALL_NAV_ITEMS } from '@/lib/constants/navItems';
import { useHiddenPages } from '@/lib/hooks/useHiddenPages';
import { cn } from '@/lib/utils';
import { contrastText } from '@/lib/utils/color';
import { LCARSButton, LCARSRail, type LCARSAccent } from './LCARSPrimitives';

export type LCARSNavigationProps = {
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    color?: string;
  } | null;
  onLogout?: () => void;
  onLogin?: () => void;
  hidden?: boolean;
  className?: string;
};

const ACCENTS: LCARSAccent[] = [
  'orange',
  'peach',
  'lavender',
  'salmon',
  'purple',
  'yellow',
  'blue',
];

export function LCARSNavigation({
  user,
  onLogout,
  onLogin,
  hidden = false,
  className,
}: LCARSNavigationProps) {
  const pathname = usePathname();
  const { filterNavItems } = useHiddenPages();
  const navItems = filterNavItems(ALL_NAV_ITEMS);

  const isActive = React.useCallback(
    (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href)),
    [pathname]
  );

  return (
    <aside
      className={cn('lcars-navigation', className)}
      data-hidden={hidden || undefined}
      aria-label="Primary navigation rail"
    >
      <div className="lcars-navigation__designation" aria-hidden="true">
        <span>LCARS</span>
        <strong>47</strong>
      </div>

      <nav className="lcars-navigation__scroll" aria-label="Prism sections">
        <ul>
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const accent = active ? 'yellow' : ACCENTS[index % ACCENTS.length];

            return (
              <li key={item.href}>
                <LCARSButton
                  asChild
                  accent={accent}
                  active={active}
                  size="small"
                  roundedEnd="end"
                  className="lcars-navigation__link"
                >
                  <Link
                    href={item.href}
                    prefetch={false}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon aria-hidden="true" />
                    <span>{item.label}</span>
                    <small>{String(index + 1).padStart(2, '0')}</small>
                  </Link>
                </LCARSButton>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="lcars-navigation__utility">
        <LCARSRail accent="salmon" size="thin" roundedEnd="end" />
        <LCARSButton asChild accent="purple" size="small" roundedEnd="end">
          <Link href="/help" prefetch={false}>
            <HelpCircle aria-hidden="true" />
            <span>Help</span>
            <small>HLP</small>
          </Link>
        </LCARSButton>
        <LCARSButton
          accent={user ? 'lavender' : 'red'}
          size="small"
          roundedEnd="end"
          status={user ? 'online' : 'standby'}
          onClick={user ? onLogout : onLogin}
          aria-label={user ? `Log out ${user.name}` : 'Log in'}
        >
          {user ? (
            <span
              className="lcars-navigation__avatar"
              style={{
                backgroundColor: user.color || '#6b7280',
                color: contrastText(user.color || '#6b7280'),
              }}
            >
              {user.avatarUrl?.startsWith('emoji:') ? (
                <span>{user.avatarUrl.slice(6)}</span>
              ) : user.avatarUrl ? (
                <Image src={user.avatarUrl} alt="" fill unoptimized className="object-cover" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </span>
          ) : (
            <User aria-hidden="true" />
          )}
          <span>{user ? user.name : 'Log in'}</span>
        </LCARSButton>
      </div>
    </aside>
  );
}
