'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useAwayMode } from '@/lib/hooks/useAwayMode';
import { useBabysitterMode } from '@/lib/hooks/useBabysitterMode';
import { useIdleDetection } from '@/lib/hooks/useIdleDetection';
import { useIdleLogout } from '@/lib/hooks/useIdleLogout';
import { ScreenCleaningOverlay } from '@/components/screen-cleaning/ScreenCleaningOverlay';

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
const AttentionPanel = dynamic(
  () => import('@/components/attention/AttentionPanel').then(m => ({ default: m.AttentionPanel })),
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
      <ScreenCleaningOverlay />
      {babysitterActive && <BabysitterModeOverlay toggle={toggleBabysitter} />}
      {isAway && <AwayModeOverlay toggle={toggleAway} />}
      {/* Mounted while awake as well as idle, because the idle-dim layer has to
          be in place before the display goes idle. Its data work is gated on
          `isIdle` inside, so an awake page does not poll for it.
          The solar observatory is itself an always-on wall display. */}
      {pathname !== '/solar' && <Screensaver idleOverride={isIdle} />}
      {/* After the screensaver: same layer, so its notices show over it. */}
      <AttentionPanel />
    </>
  );
}
