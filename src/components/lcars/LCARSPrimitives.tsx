'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

export type LCARSAccent =
  | 'orange'
  | 'peach'
  | 'salmon'
  | 'lavender'
  | 'purple'
  | 'red'
  | 'yellow'
  | 'blue';

export type LCARSOrientation = 'horizontal' | 'vertical';
export type LCARSRoundedEnd = 'start' | 'end' | 'both' | 'none';

type LCARSVisualProps = {
  accent?: LCARSAccent;
  className?: string;
};

export type LCARSRailProps = LCARSVisualProps & {
  orientation?: LCARSOrientation;
  roundedEnd?: LCARSRoundedEnd;
  size?: 'thin' | 'medium' | 'thick';
  label?: string;
};

export function LCARSRail({
  accent = 'orange',
  orientation = 'horizontal',
  roundedEnd = 'both',
  size = 'medium',
  label,
  className,
}: LCARSRailProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('lcars-rail', className)}
      data-accent={accent}
      data-orientation={orientation}
      data-rounded-end={roundedEnd}
      data-size={size}
    >
      {label && <span>{label}</span>}
    </div>
  );
}

export type LCARSElbowProps = LCARSVisualProps & {
  direction?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  label?: string;
};

export function LCARSElbow({
  accent = 'orange',
  direction = 'top-left',
  label,
  className,
}: LCARSElbowProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('lcars-elbow', className)}
      data-accent={accent}
      data-direction={direction}
    >
      {label && <span>{label}</span>}
    </div>
  );
}

export type LCARSButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> &
  LCARSVisualProps & {
    asChild?: boolean;
    active?: boolean;
    roundedEnd?: LCARSRoundedEnd;
    size?: 'small' | 'medium' | 'large';
    status?: 'online' | 'standby' | 'alert';
  };

export const LCARSButton = React.forwardRef<HTMLButtonElement, LCARSButtonProps>(
  (
    {
      asChild = false,
      accent = 'orange',
      active = false,
      roundedEnd = 'end',
      size = 'medium',
      status,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const sharedProps = {
      className: cn('lcars-button', className),
      'data-accent': accent,
      'data-active': active || undefined,
      'data-rounded-end': roundedEnd,
      'data-size': size,
      ...props,
    };

    if (asChild) {
      return (
        <Slot ref={ref} {...sharedProps}>
          {children}
        </Slot>
      );
    }

    return (
      <button ref={ref} {...sharedProps}>
        {status && (
          <span
            className="lcars-button__status"
            data-status={status}
            aria-label={`${status} status`}
          />
        )}
        {children}
      </button>
    );
  }
);
LCARSButton.displayName = 'LCARSButton';

export type LCARSDataReadoutProps = LCARSVisualProps & {
  label: string;
  value: React.ReactNode;
  status?: 'online' | 'standby' | 'alert';
  compact?: boolean;
};

export function LCARSDataReadout({
  label,
  value,
  status,
  accent = 'lavender',
  compact = false,
  className,
}: LCARSDataReadoutProps) {
  return (
    <div
      className={cn('lcars-readout', className)}
      data-accent={accent}
      data-compact={compact || undefined}
    >
      <span className="lcars-readout__label">{label}</span>
      <span className="lcars-readout__value">
        {status && <span className="lcars-readout__indicator" data-status={status} />}
        {value}
      </span>
    </div>
  );
}

export type LCARSSectionHeaderProps = LCARSVisualProps & {
  label: string;
  code?: string;
  trailing?: React.ReactNode;
};

export function LCARSSectionHeader({
  label,
  code,
  trailing,
  accent = 'peach',
  className,
}: LCARSSectionHeaderProps) {
  return (
    <div className={cn('lcars-section-header', className)} data-accent={accent}>
      <span className="lcars-section-header__cap">{code ?? 'SYS'}</span>
      <span className="lcars-section-header__line" aria-hidden="true" />
      <h2>{label}</h2>
      {trailing && <div className="lcars-section-header__trailing">{trailing}</div>}
    </div>
  );
}

export type LCARSPanelProps = LCARSVisualProps & {
  children: React.ReactNode;
  label?: string;
  code?: string;
  inset?: boolean;
};

export function LCARSPanel({
  children,
  label,
  code,
  accent = 'purple',
  inset = false,
  className,
}: LCARSPanelProps) {
  return (
    <section
      className={cn('lcars-panel', className)}
      data-accent={accent}
      data-inset={inset || undefined}
    >
      {label && <LCARSSectionHeader label={label} code={code} accent={accent} />}
      <div className="lcars-panel__content">{children}</div>
    </section>
  );
}

export type LCARSFrameProps = {
  children: React.ReactNode;
  enabled?: boolean;
  label?: string;
  code?: string;
  compact?: boolean;
  chromeHidden?: boolean;
  className?: string;
};

export function LCARSFrame({
  children,
  enabled = true,
  label = 'PRIMARY OPERATIONS',
  code = '47-A',
  compact = false,
  chromeHidden = false,
  className,
}: LCARSFrameProps) {
  const [measureHidden, setMeasureHidden] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return;
    const handleMeasureMode = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setMeasureHidden(
        typeof detail === 'boolean' ? detail : Boolean(detail?.active && detail?.hideNav)
      );
    };
    window.addEventListener('prism:measure-mode', handleMeasureMode);
    return () => window.removeEventListener('prism:measure-mode', handleMeasureMode);
  }, [enabled]);

  if (!enabled) return <>{children}</>;

  const hidden = chromeHidden || measureHidden;

  return (
    <div
      className={cn('lcars-frame', compact && 'lcars-frame--compact', className)}
      data-lcars-frame="true"
      data-chrome-hidden={hidden || undefined}
    >
      <div className="lcars-frame__heading">
        <LCARSSectionHeader label={label} code={code} accent="peach" />
      </div>
      <LCARSPanel accent="purple" inset className="lcars-frame__panel">
        {children}
      </LCARSPanel>
      <div className="lcars-frame__lower-rail" aria-hidden="true">
        <LCARSRail accent="lavender" size="thin" roundedEnd="start" />
        <LCARSRail accent="orange" size="thin" roundedEnd="end" />
      </div>
    </div>
  );
}

export type LCARSStatusBarProps = {
  hidden?: boolean;
  designation?: string;
};

export function LCARSStatusBar({ hidden = false, designation = 'NCC-047-D' }: LCARSStatusBarProps) {
  const [now, setNow] = React.useState<Date | null>(null);
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    const updateClock = () => setNow(new Date());
    const updateNetwork = () => setOnline(navigator.onLine);
    updateClock();
    updateNetwork();
    const timer = window.setInterval(updateClock, 1000);
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
    };
  }, []);

  const time = now
    ? new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now)
    : '--:--:--';
  const date = now
    ? new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: '2-digit',
      }).format(now)
    : 'INITIALIZING';

  return (
    <header
      className="lcars-status-bar"
      data-hidden={hidden || undefined}
      aria-label="Prism system status"
    >
      <LCARSElbow accent="orange" direction="top-left" label="PRISM" />
      <LCARSRail accent="orange" roundedEnd="end" className="lcars-status-bar__primary-rail" />
      <LCARSDataReadout label="DATE" value={date} compact accent="peach" />
      <LCARSDataReadout
        label="NETWORK"
        value={online ? 'LINK ONLINE' : 'LINK OFFLINE'}
        status={online ? 'online' : 'alert'}
        compact
        accent={online ? 'blue' : 'red'}
      />
      <LCARSDataReadout label="SYSTEM" value={designation} compact accent="lavender" />
      <time className="lcars-status-bar__clock" dateTime={now?.toISOString()}>
        {time}
      </time>
    </header>
  );
}

export type LCARSStatusFooterProps = {
  hidden?: boolean;
  navOffset?: boolean;
};

export function LCARSStatusFooter({ hidden = false, navOffset = false }: LCARSStatusFooterProps) {
  return (
    <footer
      className="lcars-status-footer"
      data-hidden={hidden || undefined}
      data-nav-offset={navOffset || undefined}
      aria-label="Prism secondary system status"
    >
      <span>ENVIRONMENTAL SYSTEMS NOMINAL</span>
      <LCARSRail accent="purple" size="thin" roundedEnd="both" />
      <span className="lcars-status-footer__hint">SELECT MODULE · DOUBLE-TAP TO EXPAND</span>
      <strong>OPS 47</strong>
    </footer>
  );
}
