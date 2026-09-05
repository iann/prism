'use client';

import { useEffect, useRef } from 'react';
import type { CameraVideoState } from './CameraEventCard';

type CameraVideoPlayerProps = {
  cameraId: string;
  retryKey?: number;
  onStateChange?: (state: CameraVideoState) => void;
};

function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, 4_000);
    const onChange = () => {
      if (peer.iceGatheringState !== 'complete') return;
      window.clearTimeout(timeout);
      peer.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    peer.addEventListener('icegatheringstatechange', onChange);
  });
}

export function CameraVideoPlayer({ cameraId, retryKey = 0, onStateChange }: CameraVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const controller = new AbortController();
    let peer: RTCPeerConnection | null = null;
    let sessionId: string | null = null;
    let heartbeat: number | null = null;
    let finished = false;

    const state = (next: CameraVideoState) => {
      if (!finished) onStateChange?.(next);
    };

    const run = async () => {
      state('connecting');
      try {
        const sessionResponse = await fetch(`/api/cameras/${encodeURIComponent(cameraId)}/sessions`, {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]),
        });
        if (!sessionResponse.ok) throw new Error('Camera session unavailable');
        const sessionPayload = await sessionResponse.json() as { session?: { id?: string } };
        sessionId = typeof sessionPayload.session?.id === 'string' ? sessionPayload.session.id : null;
        if (!sessionId) throw new Error('Camera session did not return an ID');

        peer = new RTCPeerConnection();
        peer.addTransceiver('video', { direction: 'recvonly' });
        peer.ontrack = (event) => {
          if (event.streams[0]) video.srcObject = event.streams[0];
        };
        peer.onconnectionstatechange = () => {
          if (peer?.connectionState === 'failed' || peer?.connectionState === 'disconnected') state('unavailable');
        };

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await waitForIceGathering(peer);
        const local = peer.localDescription;
        if (!local?.sdp) throw new Error('WebRTC offer was empty');

        const answerResponse = await fetch(`/api/cameras/sessions/${encodeURIComponent(sessionId)}/webrtc`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ type: local.type, sdp: local.sdp }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]),
        });
        if (!answerResponse.ok) throw new Error('Camera video negotiation failed');
        const answer = await answerResponse.json() as RTCSessionDescriptionInit;
        await peer.setRemoteDescription(answer);

        heartbeat = window.setInterval(() => {
          if (!sessionId) return;
          void fetch(`/api/cameras/sessions/${encodeURIComponent(sessionId)}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cameraId }),
            signal: AbortSignal.timeout(5_000),
          }).catch(() => undefined);
        }, 15_000);

        const markLive = () => state('live');
        video.addEventListener('playing', markLive, { once: true });
        video.addEventListener('loadeddata', markLive, { once: true });
        await video.play().catch(() => undefined);
        window.setTimeout(() => {
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) state('unavailable');
        }, 5_000);
      } catch {
        if (!controller.signal.aborted) state('unavailable');
      }
    };
    void run();

    return () => {
      finished = true;
      controller.abort();
      if (heartbeat !== null) window.clearInterval(heartbeat);
      peer?.close();
      video.srcObject = null;
      if (sessionId) {
        void fetch(`/api/cameras/sessions/${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cameraId }),
          keepalive: true,
        }).catch(() => undefined);
      }
    };
  }, [cameraId, onStateChange, retryKey]);

  return <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />;
}
