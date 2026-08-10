'use client';

import { useEffect } from 'react';
import { House, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WallStateScreen } from '@/components/wall';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <WallStateScreen
      icon={<TriangleAlert className="h-8 w-8" aria-hidden="true" />}
      title="Something went wrong"
      description={
        <p>
          {process.env.NODE_ENV === 'development'
            ? error.message
            : 'An unexpected error occurred. Please try again.'}
        </p>
      }
      actions={
        <>
          <Button type="button" size="touch" onClick={reset}>Try again</Button>
          <Button type="button" size="touch" variant="secondary" onClick={() => window.location.assign('/')}>
            <House className="h-5 w-5" aria-hidden="true" />
            Go to dashboard
          </Button>
        </>
      }
    />
  );
}
