'use client';

import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_SEVERITY_FILTER } from '@/lib/config/nws-alerts';

export interface NWSAlert {
  id: string;
  event: string;
  headline: string;
  description: string;
  effective: string;
  expires: string;
}

export interface UseNWSAlertsOptions {
  /** How often to poll the alerts endpoint (ms). Default: 120 000. */
  pollIntervalMs?: number;
  /** NWS event names that count as "severe". Defaults to the four standard types. */
  severityFilter?: string[];
}

export interface UseNWSAlertsResult {
  alerts: NWSAlert[];
  hasSevereAlert: boolean;
  error: string | null;
  loading: boolean;
}

export function useNWSAlerts({
  pollIntervalMs = 120_000,
  severityFilter = [...DEFAULT_SEVERITY_FILTER],
}: UseNWSAlertsOptions = {}): UseNWSAlertsResult {
  const [alerts, setAlerts] = useState<NWSAlert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Keep a stable ref to severityFilter to avoid re-creating the poll callback
  // when the caller passes an inline array literal.
  const filterKey = severityFilter.join('\0');

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/weather/alerts');

      if (res.status === 503) {
        // Feature not configured — remain dormant, no error shown to user.
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json() as { alerts?: NWSAlert[] };
      const filter = new Set(filterKey.split('\0'));
      const severe = (data.alerts ?? []).filter((a) => filter.has(a.event));

      setAlerts(severe);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch alerts';
      setError(message);
      // Intentionally do NOT clear existing alerts — keep displaying the last
      // known state so the modal stays visible during brief network blips.
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, pollIntervalMs);
    return () => clearInterval(id);
  }, [poll, pollIntervalMs]);

  return {
    alerts,
    hasSevereAlert: alerts.length > 0,
    error,
    loading,
  };
}
