'use client';

import * as React from 'react';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import {
  APP_VERSION_CHECK_INTERVAL,
  fetchServerAppVersion,
  isNewerAppVersion,
  reloadForAppUpdate,
} from '@/lib/appVersion';

const CLIENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

/**
 * Keeps an already-open dashboard in sync with the version currently running
 * on the server. This is intentionally global so it also covers setup and
 * non-dashboard pages that may remain open on a wall display.
 */
export function AppVersionChecker() {
  const reloadStartedRef = React.useRef(false);

  const checkForUpdate = React.useCallback(async () => {
    if (document.hidden || reloadStartedRef.current) return;

    try {
      const serverVersion = await fetchServerAppVersion();
      if (!isNewerAppVersion(CLIENT_VERSION, serverVersion)) return;

      reloadStartedRef.current = true;
      await reloadForAppUpdate();
    } catch {
      // Version checks are opportunistic. A transient network or deployment
      // error should not affect the dashboard or prevent the next check.
    }
  }, []);

  React.useEffect(() => {
    void checkForUpdate();
  }, [checkForUpdate]);

  useVisibilityPolling(checkForUpdate, APP_VERSION_CHECK_INTERVAL);

  return null;
}
