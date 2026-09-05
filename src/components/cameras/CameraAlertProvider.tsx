'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FloatingCardStack } from '@/components/dashboard/FloatingCardStack';
import { useAwayMode } from '@/lib/hooks/useAwayMode';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCameraEvents, choosePrimaryCameraEvent } from '@/lib/hooks/useCameraEvents';
import { CameraEventCard, type CameraVideoState } from './CameraEventCard';
import { CameraVideoPlayer } from './CameraVideoPlayer';

function isCameraSuppressedRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === '/settings' ||
    pathname.startsWith('/settings/') ||
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/auth' ||
    pathname.startsWith('/auth/') ||
    pathname === '/pin' ||
    pathname.startsWith('/pin/')
  );
}

/**
 * Root-level camera alert surface. It intentionally lives beside, rather than
 * inside, Dashboard: screensaver and idle logout are display states and still
 * need to receive an authorized alert. Away mode and settings/PIN surfaces are
 * privacy-sensitive states, so the event stream is released while they are up.
 */
export function CameraAlertProvider() {
  const pathname = usePathname();
  const { isAway } = useAwayMode();
  const { isAuthenticating } = useAuth();
  const suppressed = isAway || isAuthenticating || isCameraSuppressedRoute(pathname);
  const { events, dismiss, keepOpen, loading, error } = useCameraEvents({ enabled: !suppressed });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [videoState, setVideoState] = useState<CameraVideoState>('idle');

  const selected = useMemo(() => {
    if (selectedEventId && events.some((event) => event.eventId === selectedEventId)) {
      return events.find((event) => event.eventId === selectedEventId) || null;
    }
    return choosePrimaryCameraEvent(events);
  }, [events, selectedEventId]);

  useEffect(() => {
    if (!selectedEventId || events.some((event) => event.eventId === selectedEventId)) return;
    setSelectedEventId(null);
  }, [events, selectedEventId]);

  useEffect(() => {
    setVideoState('idle');
  }, [selected?.eventId]);

  if (suppressed || loading || error || !selected) return null;

  return (
    <FloatingCardStack topOffset={16}>
      <CameraEventCard
        events={events}
        selectedEventId={selected.eventId}
        onSelect={setSelectedEventId}
        onDismiss={dismiss}
        onKeepOpen={keepOpen}
        onRetry={() => setRetryKey((value) => value + 1)}
        videoState={videoState}
        video={selected ? (
          <CameraVideoPlayer
            key={`${selected.eventId}:${retryKey}`}
            cameraId={selected.cameraId}
            retryKey={retryKey}
            onStateChange={setVideoState}
          />
        ) : undefined}
      />
    </FloatingCardStack>
  );
}
