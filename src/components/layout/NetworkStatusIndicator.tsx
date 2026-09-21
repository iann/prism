'use client';

import * as React from 'react';

/**
 * Shows a small, persistent signal when the browser reports that the network
 * connection is offline. The initial value stays online until the first
 * client-side check so server and client markup remain identical.
 */
export function NetworkStatusIndicator() {
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    const updateNetwork = () => setOnline(navigator.onLine);

    updateNetwork();
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);

    return () => {
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
    };
  }, []);

  if (online) return null;

  return (
    <div
      className="pointer-events-none fixed top-4 right-4 z-[10001]"
      data-testid="network-status-indicator"
      role="status"
      aria-live="polite"
      aria-label="Offline: no network connection"
      title="Offline: no network connection"
    >
      <span
        aria-hidden="true"
        className="network-offline-dot--pulse bg-destructive block h-3 w-3 rounded-full"
      />
    </div>
  );
}
