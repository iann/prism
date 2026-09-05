'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BellRing, Camera, Clock3, Loader2, RefreshCw, Video, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CameraEvent } from '@/lib/hooks/useCameraEvents';

export type CameraVideoState = 'idle' | 'connecting' | 'live' | 'unavailable';

export type CameraEventCardProps = {
  events: CameraEvent[];
  selectedEventId?: string | null;
  onSelect?: (eventId: string) => void;
  onDismiss: (eventId: string) => void;
  onKeepOpen?: (eventId: string) => void;
  onRetry?: (event: CameraEvent) => void;
  video?: ReactNode;
  videoState?: CameraVideoState;
  className?: string;
};

function formatEventTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(timestamp);
}

function eventLabel(event: CameraEvent): string {
  return event.kind === 'doorbell' ? 'Someone rang the doorbell' : 'Motion detected';
}

function captureLabel(event: CameraEvent): string {
  if (event.snapshotCapturedAt) return `Picture captured ${formatEventTime(event.snapshotCapturedAt)}`;
  return 'Picture time unavailable';
}

export function CameraEventCard({
  events,
  selectedEventId,
  onSelect,
  onDismiss,
  onKeepOpen,
  onRetry,
  video,
  videoState = 'idle',
  className,
}: CameraEventCardProps) {
  const selected = useMemo(
    () => events.find((event) => event.eventId === selectedEventId) || events[0] || null,
    [events, selectedEventId]
  );
  const [snapshotFailed, setSnapshotFailed] = useState(false);
  const [keptOpen, setKeptOpen] = useState(false);

  useEffect(() => {
    setSnapshotFailed(false);
    setKeptOpen(false);
  }, [selected?.eventId]);

  if (!selected) return null;

  const displayVideo = video && videoState !== 'unavailable';
  const showConnecting = videoState === 'connecting';
  const showUnavailable = videoState === 'unavailable';

  const keep = () => {
    setKeptOpen(true);
    onKeepOpen?.(selected.eventId);
  };

  return (
    <Card
      className={cn(
        'w-[min(32rem,calc(100vw-2rem))] max-w-full overflow-hidden border-border/70 bg-card/95 shadow-xl backdrop-blur-sm',
        className
      )}
      aria-label={`${selected.cameraName} camera alert`}
      data-testid="camera-event-card"
    >
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 p-4 pb-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            {selected.kind === 'doorbell' ? <BellRing className="h-5 w-5 text-primary" /> : <Camera className="h-5 w-5 text-primary" />}
            <span className="truncate">{selected.cameraName}</span>
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{eventLabel(selected)}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => onDismiss(selected.eventId)}
          aria-label={`Dismiss ${selected.cameraName} camera alert`}
          title="Dismiss"
        >
          <X className="h-5 w-5" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted" data-testid="camera-event-media">
          {displayVideo ? (
            <div className="absolute inset-0">{video}</div>
          ) : !snapshotFailed ? (
            <img
              src={selected.snapshotUrl}
              alt={`${selected.cameraName} snapshot`}
              className="h-full w-full object-cover"
              onError={() => setSnapshotFailed(true)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
              <Camera className="h-8 w-8 opacity-60" />
              <span className="text-sm">No picture is available</span>
            </div>
          )}

          {showConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-white" data-testid="camera-event-connecting">
              <span className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Connecting to camera…</span>
            </div>
          )}
          {showUnavailable && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/65 px-3 py-2 text-white" data-testid="camera-event-video-unavailable">
              <span className="text-sm">Live video unavailable</span>
              {onRetry && (
                <Button variant="secondary" size="sm" onClick={() => onRetry(selected)}>
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
              )}
            </div>
          )}
          {videoState === 'live' && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-xs font-medium text-white" data-testid="camera-event-live">
              <Video className="h-3.5 w-3.5" /> Live
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1 truncate" title={captureLabel(selected)}>
            <Clock3 className="h-3.5 w-3.5 shrink-0" /> {formatEventTime(selected.occurredAt)} · {captureLabel(selected)}
          </span>
          {onKeepOpen && (
            <Button variant="outline" size="sm" className="shrink-0" onClick={keep} disabled={keptOpen}>
              {keptOpen ? 'Keeping open' : 'Keep open'}
            </Button>
          )}
        </div>

        {events.length > 1 && (
          <div className="flex gap-2 overflow-x-auto border-t border-border/60 pt-3" aria-label="Other camera alerts" role="tablist">
            {events.map((event) => (
              <button
                key={event.eventId}
                type="button"
                role="tab"
                aria-selected={event.eventId === selected.eventId}
                onClick={() => onSelect?.(event.eventId)}
                className={cn(
                  'min-h-11 shrink-0 rounded-lg border px-3 text-left text-xs transition-colors',
                  event.eventId === selected.eventId
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/70 text-muted-foreground hover:bg-accent'
                )}
              >
                <span className="block max-w-40 truncate font-medium">{event.cameraName}</span>
                <span className="block capitalize">{event.kind === 'doorbell' ? 'Doorbell' : 'Motion'}</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
