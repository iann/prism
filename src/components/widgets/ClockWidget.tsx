'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useLocale } from 'next-intl';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTime, toDisplayDate } from '@/lib/utils/timeFormat';
import { WidgetContainer } from './WidgetContainer';
import { ClockGreeting } from './ClockGreeting';

export interface ClockWidgetProps {
  showGreeting?: boolean;
  showSeconds?: boolean;
  format24Hour?: boolean;
  showDate?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function millisecondsUntilNextClockTick(showSeconds: boolean, now = Date.now()) {
  const interval = showSeconds ? 1_000 : 60_000;
  return interval - (now % interval);
}

export const ClockWidget = React.memo(function ClockWidget({
  showGreeting = true,
  showSeconds = false,
  format24Hour,
  showDate = true,
  size = 'medium',
  className,
}: ClockWidgetProps) {
  const { timeFormat: globalTimeFormat, displayTimezone } = useTimeFormat();
  const locale = useLocale();
  const effectiveTimeFormat = format24Hour === undefined
    ? globalTimeFormat
    : format24Hour ? '24h' : '12h';
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const update = () => setCurrentTime(new Date());
    update();

    const intervalMs = showSeconds ? 1_000 : 60_000;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      update();
      intervalId = setInterval(update, intervalMs);
    }, millisecondsUntilNextClockTick(showSeconds));

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [showSeconds]);

  const timeString = formatDisplayTime(currentTime, effectiveTimeFormat, { showSeconds }, displayTimezone);
  // Intl keeps the weekday/month order correct for the active locale.
  const dateString = toDisplayDate(currentTime, displayTimezone).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const timeStyles = {
    small: 'text-3xl',
    medium: 'text-5xl',
    large: 'text-7xl',
  };

  const dateStyles = {
    small: 'text-sm',
    medium: 'text-lg',
    large: 'text-xl',
  };

  return (
    <WidgetContainer
      title="Clock"
      icon={<Clock className="h-4 w-4" />}
      size={size === 'large' ? 'wide' : 'small'}
      showHeader={false}
      className={cn('flex items-center justify-center', className)}
    >
      <div className="flex flex-col items-center justify-center h-full text-center">
        {showGreeting && <ClockGreeting date={currentTime} size={size} />}

        <time
          dateTime={currentTime.toISOString()}
          className={cn(
            'font-bold tracking-tight',
            'tabular-nums',
            timeStyles[size]
          )}
        >
          {timeString}
        </time>

        {showDate && (
          <time
            dateTime={currentTime.toISOString().split('T')[0]}
            className={cn(
              'text-muted-foreground mt-1',
              dateStyles[size]
            )}
          >
            {dateString}
          </time>
        )}
      </div>
    </WidgetContainer>
  );
});

export function useCurrentTime(updateInterval = 1000): Date {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    setTime(new Date());

    const intervalId = setInterval(() => {
      setTime(new Date());
    }, updateInterval);

    return () => clearInterval(intervalId);
  }, [updateInterval]);

  return time;
}
export function formatTime(
  date: Date,
  options: { format24Hour?: boolean; showSeconds?: boolean } = {}
): string {
  const { format24Hour = false, showSeconds = false } = options;

  const formatString = format24Hour
    ? showSeconds ? 'HH:mm:ss' : 'HH:mm'
    : showSeconds ? 'h:mm:ss a' : 'h:mm a';

  return format(date, formatString);
}
