'use client';

import * as React from 'react';
import { CheckCircle2, Loader2, Radio, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { ProviderCardShell } from '../shared/ProviderCardShell';

type Candidate = {
  entity_id: string;
  friendly_name: string | null;
  state: string | null;
  app_name: string | null;
  media_content_type: string | null;
  likelyAppleTv: boolean;
};
type Status = {
  configured: boolean;
  baseUrl: string | null;
  mediaPlayerEntityId: string | null;
  remoteEntityId: string | null;
  hasToken: boolean;
};

const statusUrl = '/api/integrations/home-assistant/config-status';
const configUrl = '/api/integrations/home-assistant/config';

export function HomeAssistantAppleTvProviderCard() {
  const [status, setStatus] = React.useState<Status | null>(null);
  const [baseUrl, setBaseUrl] = React.useState('');
  const [token, setToken] = React.useState('');
  const [mediaPlayer, setMediaPlayer] = React.useState('');
  const [remote, setRemote] = React.useState('');
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [busy, setBusy] = React.useState<string | null>('status');
  const [message, setMessage] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setBusy('status');
    try {
      const response = await fetch(statusUrl);
      if (!response.ok) throw new Error('Unable to load Home Assistant status');
      const next: Status = await response.json();
      setStatus(next);
      setBaseUrl(next.baseUrl ?? '');
      setMediaPlayer(next.mediaPlayerEntityId ?? '');
      setRemote(next.remoteEntityId ?? '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load status');
    } finally {
      setBusy(null);
    }
  }, []);
  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const validateUrl = () => {
    if (!baseUrl.trim()) return 'Home Assistant URL is required.';
    try {
      const url = new URL(baseUrl.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:')
        throw new Error('Unsupported protocol');
    } catch {
      return 'Enter a valid Home Assistant URL, including http:// or https://.';
    }
    return null;
  };
  const validate = () => {
    const urlError = validateUrl();
    if (urlError) return urlError;
    if (!token.trim())
      return 'Access token is required. Stored tokens are never displayed; enter it to test or save.';
    if (!/^media_player\.[a-z0-9_-]+$/.test(mediaPlayer.trim()))
      return 'Media player must look like media_player.apple_tv.';
    if (!/^remote\.[a-z0-9_-]+$/.test(remote.trim()))
      return 'Remote must look like remote.apple_tv.';
    return null;
  };
  const payload = () => ({
    baseUrl: baseUrl.trim(),
    accessToken: token.trim(),
    mediaPlayerEntityId: mediaPlayer.trim(),
    remoteEntityId: remote.trim(),
  });
  const request = async (action: 'discover' | 'test' | 'save') => {
    setMessage(null);
    const error =
      action === 'discover'
        ? !baseUrl.trim()
          ? 'Home Assistant URL is required.'
          : (validateUrl() ?? (!token.trim() ? 'Enter the token to discover devices.' : null))
        : validate();
    if (error) {
      setMessage(error);
      return;
    }
    setBusy(action);
    try {
      const response = await fetch(
        action === 'save' ? configUrl : `/api/integrations/home-assistant/${action}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload()),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `${action} failed`);
      if (action === 'discover') {
        setCandidates(body.candidates ?? []);
        setMessage('Discovery complete. Choose a media player and remote below.');
      } else {
        setMessage(
          action === 'save' ? 'Home Assistant configuration saved.' : 'Connection successful.'
        );
        toast({
          title:
            action === 'save' ? 'Home Assistant saved' : 'Home Assistant connection successful',
          variant: 'success',
        });
        if (action === 'save') await refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${action} failed`);
    } finally {
      setBusy(null);
    }
  };
  const disconnect = async () => {
    setBusy('disconnect');
    setMessage(null);
    try {
      const response = await fetch(configUrl, { method: 'DELETE' });
      if (!response.ok) throw new Error('Disconnect failed');
      setStatus({
        configured: false,
        baseUrl: null,
        mediaPlayerEntityId: null,
        remoteEntityId: null,
        hasToken: false,
      });
      setBaseUrl('');
      setToken('');
      setMediaPlayer('');
      setRemote('');
      setCandidates([]);
      setMessage('Home Assistant disconnected.');
      toast({ title: 'Home Assistant disconnected', variant: 'success' });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Disconnect failed');
    } finally {
      setBusy(null);
    }
  };
  const pick = (candidate: Candidate) =>
    candidate.entity_id.startsWith('media_player.')
      ? setMediaPlayer(candidate.entity_id)
      : setRemote(candidate.entity_id);
  const mediaCandidates = candidates.filter((c) => c.entity_id.startsWith('media_player.'));
  const remoteCandidates = candidates.filter((c) => c.entity_id.startsWith('remote.'));

  return (
    <ProviderCardShell
      id="home-assistant-apple-tv"
      name="Home Assistant / Apple TV"
      icon={<Tv className="h-6 w-6 text-slate-500" aria-hidden="true" />}
      status={status?.configured ? 'connected' : 'disconnected'}
      description="Control an Apple TV through your Home Assistant instance."
      primaryAction={
        <Button size="sm" onClick={() => void request('save')} disabled={busy !== null}>
          {busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save
        </Button>
      }
    >
      <div className="space-y-4 border-t p-4">
        <p className="text-sm text-muted-foreground">
          Use a Home Assistant long-lived access token. A LAN host may require adding its host to{' '}
          <code className="rounded bg-muted px-1">PRISM_ALLOWED_INTERNAL_HOSTS</code>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="ha-url">Home Assistant URL</Label>
            <Input
              id="ha-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://homeassistant.local:8123"
            />
          </div>
          <div>
            <Label htmlFor="ha-token">Access token</Label>
            <Input
              id="ha-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={
                status?.hasToken ? 'Enter token to update connection' : 'Long-lived access token'
              }
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void request('discover')}
            disabled={busy !== null}
          >
            {busy === 'discover' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Radio className="mr-2 h-4 w-4" />
            )}
            Discover
          </Button>
          <Button variant="outline" onClick={() => void request('test')} disabled={busy !== null}>
            Test connection
          </Button>
          {status?.configured && (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => void disconnect()}
              disabled={busy !== null}
            >
              Disconnect
            </Button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="ha-media-player">Media player entity</Label>
            <Input
              id="ha-media-player"
              value={mediaPlayer}
              onChange={(e) => setMediaPlayer(e.target.value)}
              placeholder="media_player.apple_tv"
            />
          </div>
          <div>
            <Label htmlFor="ha-remote">Remote entity</Label>
            <Input
              id="ha-remote"
              value={remote}
              onChange={(e) => setRemote(e.target.value)}
              placeholder="remote.apple_tv"
            />
          </div>
        </div>
        {candidates.length > 0 && (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Discovered devices</p>
            {[
              ['Media players', mediaCandidates],
              ['Remotes', remoteCandidates],
            ].map(([label, items]) => (
              <div key={label as string}>
                <p className="text-xs font-medium text-muted-foreground">{label as string}</p>
                {(items as Candidate[]).map((candidate) => (
                  <button
                    type="button"
                    key={candidate.entity_id}
                    onClick={() => pick(candidate)}
                    className="mt-1 flex min-h-11 w-full items-start justify-between rounded-md border p-2 text-left hover:bg-muted"
                  >
                    <span>
                      <span className="block font-medium">
                        {candidate.friendly_name || candidate.entity_id}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {candidate.entity_id} · {candidate.state || 'unknown'}
                        {candidate.app_name ? ` · ${candidate.app_name}` : ''}
                      </span>
                    </span>
                    {(candidate.entity_id === mediaPlayer || candidate.entity_id === remote) && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Selected" />
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        {message && (
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        )}
      </div>
    </ProviderCardShell>
  );
}
