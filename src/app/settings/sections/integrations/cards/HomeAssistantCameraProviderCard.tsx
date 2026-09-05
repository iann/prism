'use client';

import * as React from 'react';
import { Loader2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { ProviderCardShell } from '../shared/ProviderCardShell';

type CameraRow = {
  id: string;
  name: string;
  enabled: boolean;
  haCameraEntityId: string;
  ringEntityId: string;
  motionEntityId: string;
  pictureEntityId: string;
  go2rtcAlias: string;
};

type CameraStatus = {
  configured: boolean;
  enabled?: boolean;
  baseUrl?: string;
  go2rtcBaseUrl?: string | null;
  hasAccessToken?: boolean;
  hasGo2rtcAccessToken?: boolean;
  cameras?: Array<CameraRow & { ringEntityId: string | null; motionEntityId: string | null; pictureEntityId: string | null; go2rtcAlias: string | null; eventKinds: string[] }>;
};

const DEFAULT_CAMERAS: CameraRow[] = [
  { id: 'doorbell-1', name: 'Front door', enabled: true, haCameraEntityId: '', ringEntityId: '', motionEntityId: '', pictureEntityId: '', go2rtcAlias: '' },
  { id: 'doorbell-2', name: 'Second doorbell', enabled: true, haCameraEntityId: '', ringEntityId: '', motionEntityId: '', pictureEntityId: '', go2rtcAlias: '' },
  { id: 'floodlight-1', name: 'Floodlight', enabled: true, haCameraEntityId: '', ringEntityId: '', motionEntityId: '', pictureEntityId: '', go2rtcAlias: '' },
];

export function HomeAssistantCameraProviderCard() {
  const [status, setStatus] = React.useState<CameraStatus | null>(null);
  const [baseUrl, setBaseUrl] = React.useState('');
  const [token, setToken] = React.useState('');
  const [go2rtcBaseUrl, setGo2rtcBaseUrl] = React.useState('');
  const [go2rtcToken, setGo2rtcToken] = React.useState('');
  const [displayId, setDisplayId] = React.useState('kitchen');
  const [eventToken, setEventToken] = React.useState<string | null>(null);
  const [enabled, setEnabled] = React.useState(false);
  const [cameras, setCameras] = React.useState<CameraRow[]>(DEFAULT_CAMERAS);
  const [busy, setBusy] = React.useState<string | null>('status');
  const [message, setMessage] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setBusy('status');
    try {
      const response = await fetch('/api/cameras/config', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load camera status');
      const next = await response.json() as CameraStatus;
      setStatus(next);
      setBaseUrl(next.baseUrl ?? '');
      setGo2rtcBaseUrl(next.go2rtcBaseUrl ?? '');
      setEnabled(next.enabled === true);
      if (next.cameras?.length) {
        setCameras(next.cameras.map((camera) => ({
          id: camera.id,
          name: camera.name,
          enabled: camera.enabled,
          haCameraEntityId: camera.haCameraEntityId,
          ringEntityId: camera.ringEntityId ?? '',
          motionEntityId: camera.motionEntityId ?? '',
          pictureEntityId: camera.pictureEntityId ?? '',
          go2rtcAlias: camera.go2rtcAlias ?? '',
        })));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load camera status');
    } finally {
      setBusy(null);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const updateCamera = (index: number, update: Partial<CameraRow>) => {
    setCameras((current) => current.map((camera, itemIndex) => itemIndex === index ? { ...camera, ...update } : camera));
  };

  const save = async () => {
    setBusy('save');
    setMessage(null);
    try {
      const response = await fetch('/api/cameras/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          baseUrl,
          accessToken: token,
          go2rtcBaseUrl: go2rtcBaseUrl || null,
          go2rtcAccessToken: go2rtcToken || null,
          cameras: cameras.map((camera, index) => ({
            ...camera,
            eventKinds: index < 2 ? ['doorbell', 'motion'] : ['motion'],
            ringEntityId: camera.ringEntityId || null,
            motionEntityId: camera.motionEntityId || null,
            pictureEntityId: camera.pictureEntityId || null,
            go2rtcAlias: camera.go2rtcAlias || null,
          })),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to save camera configuration');
      setToken('');
      setGo2rtcToken('');
      setMessage('Camera configuration saved. Enroll this display before viewing alerts.');
      toast({ title: 'Camera configuration saved', variant: 'success' });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save camera configuration');
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    try {
      const response = await fetch('/api/cameras/config', { method: 'DELETE' });
      if (!response.ok) throw new Error('Disconnect failed');
      setStatus({ configured: false });
      setEnabled(false);
      setToken('');
      setGo2rtcToken('');
      setMessage('Camera configuration disconnected.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Disconnect failed');
    } finally {
      setBusy(null);
    }
  };

  const enrollDisplay = async () => {
    setBusy('enroll');
    try {
      const response = await fetch('/api/cameras/displays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Display enrollment failed');
      setMessage(`This browser is enrolled as ${body.displayId}.`);
      toast({ title: 'Display enrolled', variant: 'success' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Display enrollment failed');
    } finally {
      setBusy(null);
    }
  };

  const rotateEventToken = async () => {
    setBusy('token');
    try {
      const response = await fetch('/api/cameras/ingress-token', { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to create event token');
      setEventToken(body.token || null);
      setMessage('Copy this token into Home Assistant secrets.yaml. It is shown only once.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create event token');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ProviderCardShell
      id="home-assistant-cameras"
      name="Home Assistant / Eufy Cameras"
      icon={<Video className="h-6 w-6 text-slate-500" aria-hidden="true" />}
      status={status?.configured && status.enabled ? 'connected' : 'disconnected'}
      description="Use Home Assistant events and go2rtc video for the Prism camera alert card."
      primaryAction={<Button size="sm" onClick={() => void save()} disabled={busy !== null}>{busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button>}
    >
      <div className="space-y-4 border-t p-4">
        <p className="text-sm text-muted-foreground">Configure the bridge first, then map the three cameras discovered in Home Assistant. Add the host to <code className="rounded bg-muted px-1">PRISM_ALLOWED_INTERNAL_HOSTS</code> when HA or go2rtc is on a private LAN.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="camera-ha-url">Home Assistant URL</Label><Input id="camera-ha-url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="http://homeassistant.local:8123" /></div>
          <div><Label htmlFor="camera-ha-token">Home Assistant token</Label><Input id="camera-ha-token" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder={status?.hasAccessToken ? 'Enter token to update' : 'Long-lived access token'} autoComplete="new-password" /></div>
          <div><Label htmlFor="camera-go2rtc-url">go2rtc URL</Label><Input id="camera-go2rtc-url" value={go2rtcBaseUrl} onChange={(event) => setGo2rtcBaseUrl(event.target.value)} placeholder="http://go2rtc:1984" /></div>
          <div><Label htmlFor="camera-go2rtc-token">go2rtc token (if enabled)</Label><Input id="camera-go2rtc-token" type="password" value={go2rtcToken} onChange={(event) => setGo2rtcToken(event.target.value)} placeholder={status?.hasGo2rtcAccessToken ? 'Enter token to update' : 'Optional'} autoComplete="new-password" /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enable camera event cards after display enrollment</label>
        <div className="space-y-3">
          {cameras.map((camera, index) => (
            <div key={camera.id} className="rounded-lg border p-3">
              <div className="mb-3 flex items-center justify-between gap-3"><div className="font-medium">{camera.id}</div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={camera.enabled} onChange={(event) => updateCamera(index, { enabled: event.target.checked })} /> Enabled</label></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {([['name', 'Display name'], ['haCameraEntityId', 'HA camera entity'], ['ringEntityId', 'Ring entity (doorbells)'], ['motionEntityId', 'Motion entity'], ['pictureEntityId', 'Picture entity (optional)'], ['go2rtcAlias', 'go2rtc stream alias']] as const).map(([field, label]) => (
                  <div key={field}><Label htmlFor={`camera-${camera.id}-${field}`}>{label}</Label><Input id={`camera-${camera.id}-${field}`} value={camera[field]} onChange={(event) => updateCamera(index, { [field]: event.target.value })} placeholder={field === 'haCameraEntityId' ? 'camera.front_door' : ''} /></div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void refresh()} disabled={busy !== null}>Refresh status</Button>{status?.configured && <Button variant="ghost" className="text-destructive" onClick={() => void disconnect()} disabled={busy !== null}>Disconnect</Button>}</div>
        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <p className="text-sm font-medium">Display enrollment and Home Assistant event token</p>
          <div className="flex flex-wrap items-end gap-2"><div className="min-w-48"><Label htmlFor="camera-display-id">Display ID</Label><Input id="camera-display-id" value={displayId} onChange={(event) => setDisplayId(event.target.value)} placeholder="kitchen" /></div><Button variant="outline" onClick={() => void enrollDisplay()} disabled={busy !== null || !status?.configured}>Enroll this display</Button><Button variant="outline" onClick={() => void rotateEventToken()} disabled={busy !== null || !status?.configured}>Generate HA token</Button></div>
          {eventToken && <code className="block max-w-full overflow-auto rounded bg-muted p-2 text-xs" data-testid="camera-event-token">{eventToken}</code>}
        </div>
        {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
      </div>
    </ProviderCardShell>
  );
}
