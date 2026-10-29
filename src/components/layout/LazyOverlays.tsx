'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useAwayMode } from '@/lib/hooks/useAwayMode';
import { useBabysitterMode } from '@/lib/hooks/useBabysitterMode';
import { useIdleDetection } from '@/lib/hooks/useIdleDetection';
import { useIdleLogout } from '@/lib/hooks/useIdleLogout';

const Screensaver = dynamic(
  () => import('@/components/screensaver/Screensaver').then(m => ({ default: m.Screensaver })),
  { ssr: false }
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

  return (
    <>
      {babysitterActive && <BabysitterModeOverlay toggle={toggleBabysitter} />}
      {isAway && <AwayModeOverlay toggle={toggleAway} />}
      {/* Mounted while awake as well as idle: the idle-dim layer and the
          calm-mode handshake both live in the Screensaver and have to be in
          place before the display goes idle. Its data work is gated on `isIdle`
          inside, so an awake page does not poll for it.
          The solar observatory is itself an always-on wall display. */}
      {pathname !== '/solar' && <Screensaver idleOverride={isIdle} />}
    </>
  );
}
