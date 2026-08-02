export const APP_VERSION_CHECK_INTERVAL = 60 * 1000;

interface BuildResponse {
  buildId: unknown;
}

/**
 * Fetch the build ID from the running server. The cache-busting query string
 * covers browsers and older service workers that do not fully honor the
 * no-store request option.
 */
export async function fetchServerBuildId(): Promise<string | null> {
  const response = await fetch(`/api/version?check=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });

  if (!response.ok) return null;

  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('buildId' in data)) {
    return null;
  }

  const buildId: unknown = (data as BuildResponse).buildId;
  return typeof buildId === 'string' && buildId.length > 0 ? buildId : null;
}

export function isDifferentBuild(
  clientBuildId: string | undefined,
  serverBuildId: string | null
): boolean {
  return Boolean(clientBuildId && serverBuildId && clientBuildId !== serverBuildId);
}

function waitForServiceWorkerActivation(worker: ServiceWorker, timeoutMs: number): Promise<void> {
  if (worker.state === 'activated' || worker.state === 'redundant') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (timeout) clearTimeout(timeout);
      worker.removeEventListener('statechange', handleStateChange);
      resolve();
    };

    const handleStateChange = () => {
      if (worker.state === 'activated' || worker.state === 'redundant') finish();
    };

    worker.addEventListener('statechange', handleStateChange);
    timeout = setTimeout(finish, timeoutMs);
  });
}

/**
 * Update the PWA worker before reloading so the next page load uses the new
 * precache manifest and assets. A normal browser reload is still sufficient
 * when the app is not installed as a PWA.
 */
export async function reloadForAppUpdate(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        if (registration.installing) {
          await waitForServiceWorkerActivation(registration.installing, 3000);
        }
      }
    } catch {
      // A worker update is best effort; reloading still fetches the latest
      // server-rendered page and is the important part of the update flow.
    }
  }

  window.location.reload();
}
