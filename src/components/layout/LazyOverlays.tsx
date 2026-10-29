'use client';

import { useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useAwayMode } from '@/lib/hooks/useAwayMode';
import { useBabysitterMode } from '@/lib/hooks/useBabysitterMode';
import { useIdleDetection } from '@/lib/hooks/useIdleDetection';
import { useIdleLogout } from '@/lib/hooks/useIdleLogout';
import { setCalmIdle, useActiveScreensaverMode } from '@/components/screensaver/calmMode';

// Its own chunk, but rendered rather than client-only: the idle-dim layer lives
// inside it and has to exist while the display is awake, so it can ease in on
// going idle. With `ssr: false` it stayed unrendered until something else
// re-rendered this tree.
const Screensaver = dynamic(
  () => import('@/components/screensaver/Screensaver').then(m => ({ default: m.Screensaver })),
);
const AwayModeOverlay = dynamic(
  () => import('@/components/away-mode/AwayModeOverlay').then(m => ({ default: m.AwayModeOverlay })),
  { ssr: false }
);
const BabysitterModeOverlay = dynamic(
  () => import('@/components/babysitter-mode/BabysitterModeOverlay').then(m => ({ default: m.BabysitterModeOverlay })),
  { ssr: false }
);

export function LazyOverlays() {
  const pathname = usePathname();
  const { isIdle } = useIdleDetection();
  const { isAway, toggle: toggleAway } = useAwayMode();
  const { isActive: babysitterActive, toggle: toggleBabysitter } = useBabysitterMode();
  // Mounted here because this component is already in the root layout, so the
  // check runs on every page rather than only on the dashboard.
  useIdleLogout();

  // A calm dashboard is its own idle screen (#691). Published from here rather
  // than from inside the (lazily loaded) Screensaver so the dashboard hears
  // about it in the same commit as the idle change, not a chunk load later.
  const screensaverMode = useActiveScreensaverMode();
  const calmIdleNow = isIdle && screensaverMode === 'calm';
  useLayoutEffect(() => {
    setCalmIdle(calmIdleNow);
    return () => setCalmIdle(false);
  }, [calmIdleNow]);

  return (
    <>
      {babysitterActive && <BabysitterModeOverlay toggle={toggleBabysitter} />}
      {isAway && <AwayModeOverlay toggle={toggleAway} />}
      {/* Mounted while awake as well as idle, because the idle-dim layer has to
          be in place before the display goes idle. Its data work is gated on
          `isIdle` inside, so an awake page does not poll for it.
          The solar observatory is itself an always-on wall display. */}
      {pathname !== '/solar' && <Screensaver idleOverride={isIdle} />}
    </>
  );
}
