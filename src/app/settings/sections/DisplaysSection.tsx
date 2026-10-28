'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDistance } from 'date-fns';
import Link from 'next/link';
import { Monitor, ExternalLink, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useFetchOnMount } from '@/lib/hooks/useFetchOnMount';
import { useLayouts } from '@/lib/hooks/useLayouts';
import { reloadForRemoteChange, resetSyncBase, syncScreenSettings } from '@/lib/displays/displaySettingsSync';

/**
 * Settings > Displays (#690): name each screen in the house and see which are
 * on. The same page carries the per-dashboard display settings the personal
 * fork already had — text size and the media-player card.
 */

type DisplayEntry = {
  id: string;
  name: string;
  lastSeenAt: string | null;
  online: boolean;
  dashboardId: string | null;
};

const NAME_MAX = 60;

function statusText(d: DisplayEntry, now: number): string {
  if (d.online) return 'Online';
  if (!d.lastSeenAt) return 'Not seen yet';
  return `Last seen ${formatDistance(new Date(d.lastSeenAt), now, { addSuffix: true })}`;
}

async function errorFrom(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) return 'Only a parent can name or change displays.';
  return data?.error ?? 'That did not work. Try again.';
}

export function DisplaysSection() {
  const [displays, setDisplays] = useState<DisplayEntry[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // "Last seen 3 hours ago" is measured from when the list was fetched.
  const [fetchedAt, setFetchedAt] = useState(0);
  const [authWall, setAuthWall] = useState(false);
  const [trusted, setTrusted] = useState(false);

  const { layouts, loading } = useLayouts();
  const [newName, setNewName] = useState('');
  const [takeOverId, setTakeOverId] = useState('');
  const [alsoTrust, setAlsoTrust] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-dashboard display settings. Only the values changed on this screen are
  // held here; everything else is read from the layout, so a refresh needs no
  // copy step.
  const [scaleOverrides, setScaleOverrides] = useState<Record<string, number>>({});
  const [mediaPlayerOverrides, setMediaPlayerOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [homeAssistantConfigured, setHomeAssistantConfigured] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, settings] = await Promise.all([fetch('/api/displays'), fetch('/api/settings')]);
      if (list.ok) {
        const data = await list.json();
        setDisplays(Array.isArray(data?.displays) ? data.displays : []);
        setCurrentId(typeof data?.currentId === 'string' ? data.currentId : null);
        setFetchedAt(Date.now());
      }
      if (settings.ok) {
        const data = await settings.json();
        const security = data?.security ?? data?.settings?.security;
        setAuthWall(security?.authWall?.enabled === true);
      }
      setTrusted(document.cookie.split('; ').includes('prism_trusted_display=1'));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFetchOnMount(load);

  useEffect(() => {
    let active = true;
    void fetch('/api/integrations/home-assistant/config-status')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('status unavailable')))
      .then((status: { configured?: boolean }) => { if (active) setHomeAssistantConfigured(status.configured === true); })
      .catch(() => { if (active) setHomeAssistantConfigured(false); });
    return () => { active = false; };
  }, []);

  const run = async (action: () => Promise<Response>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await action();
      if (!res.ok) {
        setError(await errorFrom(res));
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const nameThisDisplay = async () => {
    const ok = await run(() => fetch('/api/displays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    }));
    if (!ok) return;
    setNewName('');
    // A new screen: what this browser has becomes its settings, sent now
    // rather than on the next round.
    resetSyncBase();
    void syncScreenSettings();
    // Trusting stays its own decision on the server (naming a phone must not
    // exempt it from sign-in); this only saves a second trip to Security.
    if (authWall && !trusted && alsoTrust) {
      const res = await fetch('/api/auth/trust-device', { method: 'POST' });
      if (res.ok) {
        // Same readable marker SecuritySection keeps for the httpOnly cookie.
        document.cookie = 'prism_trusted_display=1; path=/; max-age=157680000';
        setTrusted(true);
      }
    }
  };

  /** This browser becomes an existing screen, taking its stored settings. */
  const takeOver = async () => {
    const ok = await run(() => fetch('/api/displays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: takeOverId }),
    }));
    if (!ok) return;
    resetSyncBase();
    const { applied } = await syncScreenSettings();
    if (applied.length > 0) reloadForRemoteChange();
  };

  const setDashboard = (id: string, dashboardId: string | null) =>
    run(() => fetch(`/api/displays/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dashboardId }),
    }));

  const rename = async (id: string) => {
    const ok = await run(() => fetch(`/api/displays/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    }));
    if (ok) setEditingId(null);
  };

  const remove = async (d: DisplayEntry) => {
    const what = d.id === currentId ? 'this screen' : `"${d.name}"`;
    if (!window.confirm(`Forget ${what}? It goes back to being an unnamed browser.`)) return;
    await run(() => fetch(`/api/displays/${d.id}`, { method: 'DELETE' }));
  };

  const mediaPlayerEnabled = (layout: (typeof layouts)[number]): boolean => {
    const override = mediaPlayerOverrides[layout.id];
    if (override !== undefined) return override;
    if (homeAssistantConfigured !== true) return false;
    return (
      layout.floatingCardSettings?.mediaPlayerPlayback?.enabled ??
      layout.floatingCardSettings?.appleTvPlayback?.enabled ??
      true
    );
  };

  const updateMediaPlayer = async (layoutId: string, enabled: boolean) => {
    setMediaPlayerOverrides((prev) => ({ ...prev, [layoutId]: enabled }));
    setSaveError(null);
    setSaving(layoutId);
    try {
      const response = await fetch(`/api/layouts/${layoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ floatingCardSettings: { mediaPlayerPlayback: { enabled } } }),
      });
      if (!response.ok) throw new Error('Media-player setting could not be saved.');
    } catch (error) {
      setMediaPlayerOverrides((prev) => {
        const next = { ...prev };
        delete next[layoutId];
        return next;
      });
      setSaveError(error instanceof Error ? error.message : 'Media-player setting could not be saved.');
    } finally {
      setSaving(null);
    }
  };

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveVersions = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const updateFontScale = (layoutId: string, scale: number) => {
    // Update local state immediately — slider stays responsive
    setScaleOverrides((prev) => ({ ...prev, [layoutId]: scale }));

    const version = (saveVersions.current[layoutId] ?? 0) + 1;
    saveVersions.current[layoutId] = version;

    // Debounce DB write so rapid slider drags don't spam the API
    if (saveTimers.current[layoutId]) clearTimeout(saveTimers.current[layoutId]);
    const timer = setTimeout(async () => {
      setSaving(layoutId);
      try {
        const response = await fetch(`/api/layouts/${layoutId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fontScale: scale === 100 ? null : scale }),
        });
        if (!response.ok) throw new Error(`Font scale save failed (${response.status})`);
      } catch {
        // Do not let an older request undo a newer slider selection.
        if (saveVersions.current[layoutId] === version) {
          setScaleOverrides((prev) => {
            const next = { ...prev };
            delete next[layoutId];
            return next;
          });
        }
      } finally {
        if (saveTimers.current[layoutId] === timer) delete saveTimers.current[layoutId];
        if (saveVersions.current[layoutId] === version) setSaving(null);
      }
    }, 400);
    saveTimers.current[layoutId] = timer;
  };

  const current = displays.find((d) => d.id === currentId) ?? null;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Displays</h2>
        <p className="text-muted-foreground">
          Name each screen in the house, so you can see which ones are on and, later,
          change a screen&apos;s settings from your phone. A browser nobody named works
          just as it always has.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>This screen</CardTitle>
          <CardDescription>
            {current
              ? <>This screen is named <strong>{current.name}</strong>.</>
              : 'Name it from the screen itself, for example "Kitchen" or "Upstairs hall".'}
          </CardDescription>
        </CardHeader>
        {loaded && !current && (
          <CardContent className="space-y-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); void nameThisDisplay(); }}
            >
              <Input
                aria-label="Name for this screen"
                placeholder="Kitchen"
                maxLength={NAME_MAX}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Button type="submit" disabled={busy || !newName.trim()}>
                Name this display
              </Button>
            </form>
            {displays.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Or this is an existing screen:</span>
                <select
                  aria-label="Existing screen"
                  className="rounded-md border border-input bg-background px-2 py-1.5"
                  value={takeOverId}
                  onChange={(e) => setTakeOverId(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {displays.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <Button size="sm" variant="outline" disabled={busy || !takeOverId} onClick={() => void takeOver()}>
                  Use its name and settings
                </Button>
              </div>
            )}
            {authWall && !trusted && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={alsoTrust}
                  onChange={(e) => setAlsoTrust(e.target.checked)}
                />
                Also trust it, so it stays readable without anyone signing in
              </label>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All screens</CardTitle>
          <CardDescription>
            A screen shows as online while it is switched on. Pick the dashboard each one
            opens on; a screen showing its home page switches within a minute.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loaded && displays.length === 0 && (
            <p className="text-sm text-muted-foreground">No screens are named yet.</p>
          )}
          <ul className="divide-y divide-border">
            {displays.map((d) => (
              <li key={d.id} data-testid="display-row" className="flex flex-wrap items-center gap-3 py-3">
                {editingId === d.id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={(e) => { e.preventDefault(); void rename(d.id); }}
                  >
                    <Input
                      aria-label={`New name for ${d.name}`}
                      maxLength={NAME_MAX}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <Button type="submit" size="sm" disabled={busy || !editName.trim()}>Save</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{d.name}</span>
                        {d.id === currentId && <Badge variant="secondary">This screen</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span
                          className={d.online ? 'inline-block h-2 w-2 rounded-full bg-green-500 mr-1.5' : 'inline-block h-2 w-2 rounded-full bg-muted-foreground/40 mr-1.5'}
                          aria-hidden
                        />
                        {statusText(d, fetchedAt)}
                      </div>
                    </div>
                    <select
                      aria-label={`Dashboard for ${d.name}`}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm max-w-[12rem]"
                      disabled={busy}
                      value={d.dashboardId ?? ''}
                      onChange={(e) => void setDashboard(d.id, e.target.value || null)}
                    >
                      <option value="">Default dashboard</option>
                      {layouts.filter((l) => !l.isDefault).map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => { setEditingId(d.id); setEditName(d.name); }}
                    >
                      Rename
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove(d)}>
                      Remove
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-bold">Per-dashboard display</h2>
        <p className="text-muted-foreground">
          How large everything reads on each of your dashboards, and whether it carries the
          media-player card. Text size scales the whole board at once, which is different
          from the per-widget text size in the layout editor. Most screens never need it —
          reach for it only if one is read from further away than the rest.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : layouts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No dashboards yet. Create one from the dashboard toolbar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {layouts.map((layout) => {
            const scale = scaleOverrides[layout.id] ?? layout.fontScale ?? 100;
            const url = layout.slug ? `/d/${layout.slug}` : '/';
            return (
              <Card key={layout.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">{layout.name}</CardTitle>
                      {layout.isDefault && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                    <Link
                      href={url}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {layout.slug ? `/d/${layout.slug}` : '/'}
                    </Link>
                  </div>
                  {layout.slug && (
                    <CardDescription className="text-xs mt-0.5">
                      Subpages available at <code className="font-mono">/d/{layout.slug}/calendar</code>, <code className="font-mono">/tasks</code>, etc.
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm">
                    <input type="checkbox" className="h-5 w-5 shrink-0 accent-primary" checked={mediaPlayerEnabled(layout)} disabled={homeAssistantConfigured !== true} onChange={(e) => void updateMediaPlayer(layout.id, e.target.checked)} aria-label={`Show media-player playback card on ${layout.name}`} />
                    <span>{homeAssistantConfigured === true ? 'Show media-player playback card on this dashboard' : 'Media-player playback unavailable until Home Assistant is configured'}</span>
                  </label>
                  {saveError && saving === null && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
                  {/* Collapsed by default. Reading a dashboard from across a room is a
                      real case but an uncommon one, and leaving the control open put a
                      slider in front of everyone to serve the few who need it.
                      Deliberately open when the value is not 100%: a display someone has
                      already tuned should not have that hidden, or the setting becomes
                      something you can change and then never find again. */}
                  <details open={scale !== 100} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-0.5 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-1 text-sm font-medium">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                        Text size
                      </span>
                      <span className={cn(
                        'text-sm tabular-nums',
                        scale !== 100 ? 'text-primary font-medium' : 'text-muted-foreground'
                      )}>
                        {scale}%
                      </span>
                    </summary>
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-6">A</span>
                      <div className="flex-1 relative">
                        <input
                          type="range"
                          min={75}
                          max={150}
                          step={5}
                          value={scale}
                          onChange={(e) => updateFontScale(layout.id, Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                        {/* 100% marker — sits at 33% from left on the 75–150 range */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2 bg-muted-foreground/40 pointer-events-none"
                          style={{ left: 'calc(33.3% - 1px)' }}
                          title="100% default"
                        />
                      </div>
                      <span className="text-base text-muted-foreground w-6">A</span>
                    </div>
                    {/* Quick-select labels — positioned proportionally on the 75–150 scale */}
                    <div className="relative h-5 mt-0.5">
                      {[75, 100, 125, 150].map((s) => {
                        const pct = ((s - 75) / 75) * 100;
                        return (
                          <button
                            key={s}
                            onClick={() => updateFontScale(layout.id, s)}
                            className={cn(
                              'absolute text-xs px-0.5 py-0.5 rounded transition-colors -translate-x-1/2',
                              scale === s
                                ? 'text-primary font-medium'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                            style={{ left: `${pct}%` }}
                          >
                            {s}%
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <span className="capitalize">{layout.orientation || 'landscape'}</span>
                    <span>·</span>
                    <span>{layout.widgets.length} widget{layout.widgets.length !== 1 ? 's' : ''}</span>
                    {saving === layout.id && (
                      <>
                        <span>·</span>
                        <span className="text-primary">Saving…</span>
                      </>
                    )}
                  </div>
                  </details>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Set a dedicated device to open <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/d/your-slug</code> as its home page, then set the text size here to match how far away it is read from.
            Larger text means fewer rows fit on the screen, so a dashboard read from across the room holds less than one read at the counter.
            Each named dashboard is independent — changes here don&apos;t affect other displays.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
