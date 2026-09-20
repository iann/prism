'use client';

import Link from 'next/link';
import { SolarWorldMap } from '@/components/widgets/SolarWorldMap';
import { useWeather } from '@/lib/hooks/useWeather';

export function SolarView() {
  const { data } = useWeather();
  return (
    <main className="bg-background min-h-dvh px-3 py-4 sm:p-6">
      <div className="mx-auto max-w-[760px]">
        <Link href="/" className="text-muted-foreground mb-4 inline-block text-xs">
          ← Dashboard
        </Link>
        <SolarWorldMap lat={data?.lat} lon={data?.lon} locationName={data?.location} readUrl />
      </div>
    </main>
  );
}
