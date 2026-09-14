'use client';

import { useCallback, useMemo, useState } from 'react';
import { Cake, Gem, Loader2, PartyPopper, Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { useBirthdays, type Birthday } from '@/lib/hooks/useBirthdays';

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function eventIcon(eventType: Birthday['eventType']) {
  if (eventType === 'anniversary') return <Gem className="h-4 w-4 text-pink-500" />;
  if (eventType === 'milestone') return <Star className="h-4 w-4 text-amber-500" />;
  return <Cake className="h-4 w-4 text-pink-500" />;
}

function eventLabel(eventType: Birthday['eventType']): string {
  if (eventType === 'anniversary') return 'Anniversary';
  if (eventType === 'milestone') return 'Milestone';
  return 'Birthday';
}

export function PartyModeSection() {
  const { birthdays, loading, error, refresh } = useBirthdays({ limit: null, enabled: true });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [optimisticValues, setOptimisticValues] = useState<Record<string, boolean>>({});

  const isEnabled = useCallback(
    (birthday: Birthday) => optimisticValues[birthday.id] ?? birthday.partyModeEnabled,
    [optimisticValues]
  );

  const enabledCount = useMemo(
    () =>
      birthdays.filter((birthday) => birthday.eventType !== 'milestone' && isEnabled(birthday))
        .length,
    [birthdays, isEnabled]
  );

  const togglePartyMode = async (birthday: Birthday, enabled: boolean) => {
    setOptimisticValues((current) => ({ ...current, [birthday.id]: enabled }));
    setSavingId(birthday.id);

    try {
      const response = await fetch(`/api/birthdays/${birthday.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyModeEnabled: enabled }),
      });

      if (!response.ok) throw new Error('Failed to save party mode setting');

      await refresh();
      toast({
        title: enabled
          ? `${birthday.name} added to party mode`
          : `${birthday.name} removed from party mode`,
      });
    } catch {
      setOptimisticValues((current) => ({
        ...current,
        [birthday.id]: birthday.partyModeEnabled,
      }));
      toast({ title: 'Failed to save party mode setting', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Party Mode</h2>
        <p className="text-muted-foreground">
          Choose which birthdays and anniversaries can trigger the family celebration. This is
          shared by every dashboard display in this Prism installation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-pink-500" />
              <CardTitle>Celebration events</CardTitle>
            </div>
            <Badge variant="secondary">{enabledCount} enabled</Badge>
          </div>
          <CardDescription>
            New synced events are off by default. Milestones are listed for visibility but do not
            support party mode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading events…
            </div>
          ) : error ? (
            <p className="py-6 text-sm text-destructive">{error}</p>
          ) : birthdays.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No birthday or anniversary events are configured yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {birthdays.map((birthday) => {
                const eligible = birthday.eventType !== 'milestone';
                const enabled = isEnabled(birthday);
                const saving = savingId === birthday.id;
                return (
                  <div
                    key={birthday.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {eventIcon(birthday.eventType)}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{birthday.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {eventLabel(birthday.eventType)} · {formatDate(birthday.nextBirthday)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      <Switch
                        checked={eligible && enabled}
                        disabled={!eligible || savingId !== null}
                        onCheckedChange={(checked) => togglePartyMode(birthday, checked)}
                        aria-label={`${enabled ? 'Disable' : 'Enable'} party mode for ${birthday.name}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
