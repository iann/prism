'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { CalendarX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WallStateScreen } from '@/components/wall';

export default function CalendarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Calendar error:', error);
  }, [error]);

  return (
    <WallStateScreen
      icon={<CalendarX className="h-8 w-8" aria-hidden="true" />}
      title="Calendar couldn’t load"
      description={
        <p>
          {process.env.NODE_ENV === 'development'
            ? error.message
            : 'Failed to load the calendar. Please try again.'}
        </p>
      }
      actions={
        <>
          <Button size="touch" onClick={reset}>Try again</Button>
          <Button asChild size="touch" variant="secondary">
            <Link href="/">Back to dashboard</Link>
          </Button>
        </>
      }
    />
  );
}
