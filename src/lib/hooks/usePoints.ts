'use client';

import { useFetch } from './useFetch';

export interface PointSummary {
  userId: string;
  name: string;
  color: string;
  weekly: number;
  monthly: number;
  yearly: number;
  allTime: number;
}

export function usePoints(options: { refreshInterval?: number; refreshOffsetMs?: number; enabled?: boolean } = {}) {
  const { refreshInterval = 2 * 60 * 1000, refreshOffsetMs, enabled } = options;
  const { data: points, loading, error, refresh } = useFetch<PointSummary[]>({
    url: '/api/points',
    initialData: [],
    transform: (json) => (json as { points: PointSummary[] }).points,
    refreshInterval,
    refreshOffsetMs,
    label: 'points',
    enabled,
  });

  return { points, loading, error, refresh };
}
