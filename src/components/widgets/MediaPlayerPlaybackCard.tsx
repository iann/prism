'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react';
import {
  ChevronsLeft,
  ChevronsRight,
  CirclePlay,
  FastForward,
  MonitorSpeaker,
  Music2,
  Pause,
  Play,
  Power,
  Rewind,
  Square,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { useMediaPlayerDismissal } from '@/lib/hooks/useMediaPlayerDismissal';
import {
  useMediaPlayerPlayback,
  type MediaPlayerPlaybackData,
} from '@/lib/hooks/useMediaPlayerPlayback';
import { estimateHomeAssistantMediaPlayerPosition } from '@/lib/integrations/homeAssistantMediaPlayer';
import { useCurrentTime } from './ClockWidget';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTime } from '@/lib/utils/timeFormat';
import { cn } from '@/lib/utils';
import { MediaPlayerArtwork } from './MediaPlayerArtwork';

const formatDuration = (seconds: number | null) =>
  seconds == null || !Number.isFinite(seconds)
    ? '--:--'
    : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const VOLUME_STEP = 0.05;
const PAUSED_CARD_TIMEOUT_MS = 5 * 60 * 1000;

function usePausedCardExpiry(
  data: Pick<
    MediaPlayerPlaybackData,
    'active' | 'state' | 'entityId' | 'mediaIdentity' | 'positionUpdatedAt'
  >,
  now: Date
) {
  const pausedSession = useRef<{ key: string; startedAt: number } | null>(null);
  const sessionKey = `${data.entityId ?? ''}:${data.mediaIdentity ?? ''}`;

  if (data.active && data.state === 'paused') {
    if (pausedSession.current?.key !== sessionKey) {
      const reportedAt = data.positionUpdatedAt ? Date.parse(data.positionUpdatedAt) : NaN;
      const nowMs = now.getTime();
      pausedSession.current = {
        key: sessionKey,
        // Home Assistant's timestamp lets an already-paused session expire on
        // first render; fall back to local observation when it is unavailable.
        startedAt: Number.isFinite(reportedAt) && reportedAt <= nowMs ? reportedAt : nowMs,
      };
    }
  } else {
    pausedSession.current = null;
  }

  return Boolean(
    data.active &&
      data.state === 'paused' &&
      pausedSession.current &&
      now.getTime() - pausedSession.current.startedAt >= PAUSED_CARD_TIMEOUT_MS
  );
}

export function MediaPlayerPlaybackCard({
  enabled = true,
  className,
}: {
  enabled?: boolean;
  className?: string;
}) {
  const { data, loading, error, action } = useMediaPlayerPlayback(enabled);
  const { timeFormat, displayTimezone } = useTimeFormat();
  const now = useCurrentTime();
  const pausedCardExpired = usePausedCardExpiry(data, now);
  const {
    ready: dismissalReady,
    dismissed,
    dismiss,
  } = useMediaPlayerDismissal({
    entityId: data.entityId,
    mediaIdentity: data.mediaIdentity,
    active: data.active,
    state: data.state,
    error,
  });
  const { confirm, dialogProps } = useConfirmDialog();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [seek, setSeek] = useState<number | null>(null);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const estimatedPlayback = estimateHomeAssistantMediaPlayerPosition(data, now);
  const position = seek ?? estimatedPlayback.position;
  const can = (control: string) => data.supportedControls.includes(control as never);
  const run = async (input: Parameters<typeof action>[0]) => {
    setPending(true);
    setActionError(null);
    try {
      await action(input);
      setSeek(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setPending(false);
    }
  };
  const seekCommit = (value: number) => {
    setSeek(null);
    void run({ control: 'seek', seekPosition: value });
  };
  const adjustVolume = (delta: number) => {
    if (data.volumeLevel == null) return;
    const nextVolume = Math.round((data.volumeLevel + delta) * 100) / 100;
    void run({ control: 'volume_set', volumeLevel: Math.min(1, Math.max(0, nextVolume)) });
  };
  const endTime = estimatedPlayback.endTime;
  useEffect(() => {
    setArtworkFailed(false);
  }, [data.artworkUrl]);
  if (
    !enabled ||
    !dismissalReady ||
    dismissed ||
    pausedCardExpired ||
    !data.visible ||
    !data.active
  )
    return null;
  const playing = data.state === 'playing';
  const playbackControl = playing ? 'pause' : data.state === 'paused' ? 'play' : null;
  const hasExplicitPlaybackControl = playbackControl !== null && can(playbackControl);
  const artwork = data.artworkUrl && !artworkFailed ? data.artworkUrl : null;
  const deviceName = data.deviceName || 'Media Player';
  return (
    <>
      <Card
        className={cn(
          'flex aspect-square w-[min(32rem,calc(100vw-2rem))] max-w-full flex-col gap-4 overflow-hidden p-4 px-8 pb-8',
          className
        )}
        aria-label={`${deviceName} playback`}
        data-testid="media-player-playback-card"
      >
        <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0 p-0">
          <CardTitle className="flex items-center gap-2">
            {data.mediaType === 'music' ? (
              <Music2 className="h-5 w-5" />
            ) : (
              <MonitorSpeaker className="h-5 w-5" />
            )}{' '}
            {deviceName}{' '}
            {data.appName && (
              <span className="text-sm font-normal text-muted-foreground">· {data.appName}</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {can('stop') && (
              <Button
                size="icon"
                variant="ghost"
                className="h-12 w-12"
                title="Stop media"
                aria-label="Stop media"
                disabled={pending}
                onClick={() => void run({ control: 'stop' })}
              >
                <Square />
              </Button>
            )}
            {can('turn_off') && (
              <Button
                size="icon"
                variant="ghost"
                className="h-12 w-12"
                title={`Turn off ${deviceName}`}
                aria-label={`Turn off ${deviceName}`}
                disabled={pending}
                onClick={async () => {
                  if (
                    await confirm(
                      `Turn off ${deviceName}?`,
                      data.remoteAvailable
                        ? `This will suspend the ${deviceName} remote and turn off the media player.`
                        : `This will turn off the ${deviceName} media player.`,
                      { confirmLabel: 'Turn off' }
                    )
                  )
                    void run({ control: 'turn_off' });
                }}
              >
                <Power />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-12 w-12"
              title={`Hide ${deviceName} playback until the media changes`}
              aria-label={`Close ${deviceName} playback`}
              onClick={dismiss}
            >
              <X />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col justify-between gap-2 p-0">
          <div className="flex items-center gap-5">
            {artwork ? (
              <img
                src={artwork}
                alt=""
                className="h-48 w-48 shrink-0 rounded-xl object-cover"
                onError={() => setArtworkFailed(true)}
              />
            ) : (
              <MediaPlayerArtwork service={data.mediaService} appName={data.appName} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-semibold">
                {data.title || data.series || data.artist || deviceName}
              </p>
              {data.series && (
                <p className="truncate text-base">
                  {data.series}
                  {data.episode ? ` · ${data.episode}` : ''}
                </p>
              )}
              {data.artist && (
                <p className="truncate text-base">
                  {data.artist}
                  {data.album ? ` · ${data.album}` : ''}
                </p>
              )}
              <p className="text-sm capitalize text-muted-foreground">{data.state}</p>
            </div>
          </div>
          {data.duration != null && data.position != null && (
            <div>
              <input
                aria-label="Playback position"
                className="h-12 w-full accent-primary"
                type="range"
                min={0}
                max={data.duration}
                step={1}
                value={Math.min(data.duration, Math.max(0, position ?? 0))}
                onChange={(e) => setSeek(Number(e.target.value))}
                onMouseUp={(e) => seekCommit(Number(e.currentTarget.value))}
                onTouchEnd={(e) => seekCommit(Number(e.currentTarget.value))}
                onKeyUp={(e) => {
                  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key))
                    seekCommit(Number(e.currentTarget.value));
                }}
                disabled={!can('seek') || pending}
              />
              <div className="flex justify-between text-sm tabular-nums">
                <span>{formatDuration(position)}</span>
                <span>
                  {endTime
                    ? `Ends in ${formatDuration(Math.max(0, data.duration - (position ?? 0)))} · ${formatDisplayTime(endTime, timeFormat, {}, displayTimezone)}`
                    : formatDuration(data.duration)}
                </span>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {can('previous') && (
              <Button
                size="icon"
                variant="ghost"
                className="h-12 w-12"
                title="Previous"
                aria-label="Previous"
                disabled={pending}
                onClick={() => void run({ control: 'previous' })}
              >
                <ChevronsLeft />
              </Button>
            )}
            {can('seek') && (
              <Button
                size="icon"
                variant="ghost"
                className="h-12 w-12"
                title="Seek back 15 seconds"
                aria-label="Seek back 15 seconds"
                disabled={pending || position == null}
                onClick={() => position != null && seekCommit(Math.max(0, position - 15))}
              >
                <Rewind />
              </Button>
            )}
            {hasExplicitPlaybackControl && (
              <Button
                size="icon"
                variant="default"
                className="h-12 w-12"
                title={playing ? 'Pause' : 'Play'}
                aria-label={playing ? 'Pause' : 'Play'}
                disabled={pending}
                onClick={() => void run({ control: playing ? 'pause' : 'play' })}
              >
                {playing ? <Pause /> : <Play />}
              </Button>
            )}
            {!hasExplicitPlaybackControl && can('play_pause') && (
              <Button
                size="icon"
                variant="ghost"
                className="h-12 w-12"
                title="Play or pause"
                aria-label="Play or pause"
                disabled={pending}
                onClick={() => void run({ control: 'play_pause' })}
              >
                <CirclePlay />
              </Button>
            )}
            {can('seek') && (
              <Button
                size="icon"
                variant="ghost"
                className="h-12 w-12"
                title="Seek forward 15 seconds"
                aria-label="Seek forward 15 seconds"
                disabled={pending || position == null}
                onClick={() =>
                  position != null &&
                  seekCommit(Math.min(data.duration ?? position + 15, position + 15))
                }
              >
                <FastForward />
              </Button>
            )}
            {can('next') && (
              <Button
                size="icon"
                variant="ghost"
                className="h-12 w-12"
                title="Next"
                aria-label="Next"
                disabled={pending}
                onClick={() => void run({ control: 'next' })}
              >
                <ChevronsRight />
              </Button>
            )}
          </div>
          {(can('volume_set') || can('volume_mute')) && (
            <div className="flex w-full flex-wrap gap-2">
              {can('volume_set') && data.volumeLevel != null && (
                <>
                  <Button
                    variant="outline"
                    className="min-h-12 flex-1"
                    title="Decrease volume by 5%"
                    aria-label="Decrease volume"
                    disabled={pending || data.volumeLevel <= 0}
                    onClick={() => adjustVolume(-VOLUME_STEP)}
                  >
                    <Volume1 className="mr-2" /> Volume −
                  </Button>
                </>
              )}
              {can('volume_mute') && (
                <Button
                  variant={data.isVolumeMuted ? 'default' : 'secondary'}
                  className="min-h-12 flex-1"
                  title={data.isVolumeMuted ? 'Unmute' : 'Mute'}
                  aria-label={data.isVolumeMuted ? 'Unmute' : 'Mute'}
                  aria-pressed={data.isVolumeMuted === true}
                  disabled={pending}
                  onClick={() =>
                    void run({ control: 'volume_mute', isVolumeMuted: !data.isVolumeMuted })
                  }
                >
                  {data.isVolumeMuted ? <VolumeX /> : <Volume2 />}
                  {data.isVolumeMuted ? 'Unmute' : 'Mute'}
                </Button>
              )}
              {can('volume_set') && data.volumeLevel != null && (
                <Button
                  variant="outline"
                  className="min-h-12 flex-1"
                  title="Increase volume by 5%"
                  aria-label="Increase volume"
                  disabled={pending || data.volumeLevel >= 1}
                  onClick={() => adjustVolume(VOLUME_STEP)}
                >
                  <Volume2 className="mr-2" /> Volume +
                </Button>
              )}
            </div>
          )}
          {(loading || error || actionError) && (
            <p role="status" className="text-sm text-destructive">
              {loading ? 'Refreshing…' : error || actionError}
            </p>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
