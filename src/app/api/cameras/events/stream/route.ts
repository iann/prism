import { NextResponse } from 'next/server';
import { getCameraDisplayGrant } from '@/lib/cameras/auth';
import {
  CameraEventStoreUnavailableError,
  getCameraEventSnapshot,
  subscribeToCameraEvents,
  type CameraEventSnapshot,
  type PublishChange,
} from '@/lib/cameras/events';
import { getHomeAssistantCameraConfig } from '@/lib/integrations/homeAssistantCameraCredentials';

export const runtime = 'nodejs';

const HEARTBEAT_MS = 15_000;

function encodeSnapshot(snapshot: CameraEventSnapshot, names: ReadonlyMap<string, string>): string {
  const named = { ...snapshot, events: snapshot.events.map((event) => ({ ...event, cameraName: names.get(event.cameraId) ?? event.cameraId })) };
  return `id: ${snapshot.revision}\nevent: camera-snapshot\ndata: ${JSON.stringify(named)}\n\n`;
}

function encodeChange(change: PublishChange, names: ReadonlyMap<string, string>): string {
  const named = { ...change, event: { ...change.event, cameraName: names.get(change.event.cameraId) ?? change.event.cameraId } };
  return `id: ${change.revision}\nevent: camera-change\ndata: ${JSON.stringify(named)}\n\n`;
}

/**
 * Subscribe before reading the snapshot. Redis Pub/Sub has no replay history,
 * so the snapshot plus revision reconciliation is the recovery protocol.
 */
export async function GET() {
  const grant = await getCameraDisplayGrant();
  if (!grant) return NextResponse.json({ error: 'Camera display enrollment required' }, { status: 401 });
  const allowedCameraIds = new Set(grant.cameraIds);
  const config = await getHomeAssistantCameraConfig().catch(() => null);
  const cameraNames = new Map((config?.cameras ?? []).map((camera) => [camera.id, camera.name]));

  let unsubscribe: (() => Promise<void>) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  let closed = false;
  let lastRevision = 0;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;

      const write = (value: string) => {
        if (!closed) controller?.enqueue(encoder.encode(value));
      };

      const reconcile = async (change: PublishChange) => {
        if (closed || change.revision <= lastRevision) return;
        if (!allowedCameraIds.has(change.event.cameraId)) {
          lastRevision = change.revision;
          return;
        }
        if (change.revision !== lastRevision + 1) {
          try {
            const snapshot = await getCameraEventSnapshot(allowedCameraIds);
            if (closed) return;
            lastRevision = snapshot.revision;
            write(encodeSnapshot(snapshot, cameraNames));
          } catch {
            // The client can reconnect; don't terminate an otherwise healthy
            // stream because a transient read failed during reconciliation.
          }
          return;
        }
        lastRevision = change.revision;
        write(encodeChange(change, cameraNames));
      };

      void (async () => {
        try {
          // Register the subscriber first so no event can arrive between the
          // initial snapshot read and subscription.
          unsubscribe = await subscribeToCameraEvents((change) => {
            void reconcile(change);
          });
          if (closed) {
            await unsubscribe();
            unsubscribe = undefined;
            return;
          }
          const snapshot = await getCameraEventSnapshot(allowedCameraIds);
          lastRevision = snapshot.revision;
          write(encodeSnapshot(snapshot, cameraNames));
          heartbeat = setInterval(() => {
            void getCameraDisplayGrant().then((currentGrant) => {
              if (!currentGrant) {
                closed = true;
                if (heartbeat) clearInterval(heartbeat);
                const stopSubscription = unsubscribe;
                unsubscribe = undefined;
                void stopSubscription?.();
                controller?.close();
                return;
              }
              write(': heartbeat\n\n');
            }).catch(() => {
              closed = true;
              if (heartbeat) clearInterval(heartbeat);
              const stopSubscription = unsubscribe;
              unsubscribe = undefined;
              void stopSubscription?.();
              controller?.close();
            });
          }, HEARTBEAT_MS);
          heartbeat.unref?.();
        } catch (error) {
          if (heartbeat) clearInterval(heartbeat);
          await unsubscribe?.();
          unsubscribe = undefined;
          if (error instanceof CameraEventStoreUnavailableError) {
            controller?.error(new Error('Camera event coordination unavailable'));
          } else {
            controller?.error(error);
          }
        }
      })();
    },
    async cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      await unsubscribe?.();
      unsubscribe = undefined;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
