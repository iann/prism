'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { hexToRgba } from '@/lib/utils/color';
import { UserAvatar } from '@/components/ui/avatar';

export type WallButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type WallButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<WallButtonVariant, string> = {
  primary: 'wall-button-primary',
  secondary: 'wall-button-secondary',
  ghost: 'wall-button-ghost',
  outline: 'wall-button-outline',
  danger: 'wall-button-danger',
};

const buttonSizes: Record<WallButtonSize, string> = {
  sm: 'wall-button-sm',
  md: 'wall-button-md',
  lg: 'wall-button-lg',
};

export interface WallButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: WallButtonVariant;
  size?: WallButtonSize;
  icon?: React.ReactNode;
}

/**
 * The primary touch control for the wall-display design language. It keeps
 * labels short and targets comfortably tappable without changing button
 * semantics or the caller's event handlers.
 */
export function WallButton({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...props
}: WallButtonProps) {
  return (
    <button
      className={cn('wall-button', buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    >
      {icon}
      {children && <span>{children}</span>}
    </button>
  );
}

export interface WallIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: WallButtonVariant;
  size?: WallButtonSize;
}

export function WallIconButton({
  label,
  variant = 'ghost',
  size = 'md',
  className,
  children,
  ...props
}: WallIconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn('wall-icon-button', buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export interface FamilyAvatarProps {
  name: string;
  color?: string | null;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

/** Consistent family identity treatment for nav, filters, and event metadata. */
export function FamilyAvatar({
  name,
  color,
  imageUrl,
  size = 'md',
  showName = false,
  className,
}: FamilyAvatarProps) {
  return (
    <span
      className={cn('wall-family-avatar', showName && 'wall-family-avatar-with-name', className)}
    >
      <UserAvatar
        name={name}
        color={color ?? undefined}
        imageUrl={imageUrl}
        size={size}
        className="wall-family-avatar-image"
      />
      {showName && <span className="wall-family-avatar-name">{name}</span>}
    </span>
  );
}

export interface WallNavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  expanded?: boolean;
  accent?: string;
}

/** Shared nav geometry used by the landscape appliance rail. */
export function WallNavItem({
  href,
  label,
  icon: Icon,
  active = false,
  expanded = false,
  accent = '#e88c75',
}: WallNavItemProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'wall-nav-item',
        active && 'wall-nav-item-active',
        expanded && 'wall-nav-item-expanded'
      )}
      style={
        {
          '--wall-nav-accent': accent,
          '--wall-nav-accent-soft': hexToRgba(accent, 0.16),
        } as React.CSSProperties
      }
    >
      <span className="wall-nav-icon-wrap">
        <Icon className="wall-nav-icon" aria-hidden="true" />
      </span>
      <span className="wall-nav-label">{label}</span>
    </Link>
  );
}

export interface WallEventCardProps extends React.HTMLAttributes<HTMLDivElement> {
  color: string;
  density?: 'compact' | 'comfortable';
}

/** Presentational event surface shared by month cells and compact agenda rows. */
export function WallEventCard({
  color,
  density = 'comfortable',
  className,
  style,
  ...props
}: WallEventCardProps) {
  return (
    <div
      className={cn(
        'wall-event-card',
        density === 'compact' ? 'wall-event-card-compact' : 'wall-event-card-comfortable',
        className
      )}
      style={
        {
          '--wall-event-color': color,
          '--wall-event-fill': hexToRgba(color, density === 'compact' ? 0.12 : 0.16),
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export function WallSurface({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('wall-surface', className)} {...props} />;
}

export interface WallStateScreenProps {
  icon?: React.ReactNode;
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** Shared full-screen treatment for loading-adjacent, error, and missing states. */
export function WallStateScreen({
  icon,
  eyebrow,
  title,
  description,
  actions,
  className,
}: WallStateScreenProps) {
  return (
    <div className={cn('wall-display wall-state-screen', className)}>
      <section className="wall-state-card" aria-live="polite">
        {icon && <div className="wall-state-icon">{icon}</div>}
        {eyebrow && <p className="wall-dashboard-eyebrow text-muted-foreground">{eyebrow}</p>}
        <h1 className="wall-state-title">{title}</h1>
        {description && <div className="wall-state-description">{description}</div>}
        {actions && <div className="wall-state-actions">{actions}</div>}
      </section>
    </div>
  );
}
