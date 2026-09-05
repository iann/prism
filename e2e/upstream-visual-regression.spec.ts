/**
 * Visual coverage for upstream-sensitive surfaces. Baselines are captured only
 * from the synthetic CI seed; see e2e/helpers/upstream.ts and the CI workflow.
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from './helpers/auth';
import { resetAll } from './helpers/reset';
import {
  HAS_TEST_DB,
  SCREENSHOT_OPTIONS,
  dynamicMasks,
  getDefaultDashboardSlug,
  getSeededParentName,
  setClientFlags,
  verifySettingsViaAPI,
  waitForStableUi,
} from './helpers/upstream';

test.describe('Upstream visual regression', () => {
  // Visual fixtures share one seeded DB and Redis session store.
  test.describe.configure({ mode: 'serial' });

  let parentName: string;

  test.beforeAll(() => {
    if (HAS_TEST_DB) {
      resetAll();
      parentName = getSeededParentName();
    }
  });

  test.beforeEach(() => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
  });

  test.use({
    contextOptions: { reducedMotion: 'reduce' },
    viewport: { width: 1920, height: 1080 },
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`scoped weekend dashboard - ${theme}`, async ({ page }) => {
      await setClientFlags(page, { theme });
      await loginViaAPI(page, parentName);
      const slug = await getDefaultDashboardSlug(page);
      await page.goto(`/d/${slug}/weekend`);
      await waitForStableUi(page, 900);

      await expect(page).toHaveScreenshot(`upstream-weekend-${theme}.png`, {
        ...SCREENSHOT_OPTIONS,
        mask: dynamicMasks(page),
      });
    });

    test(`display Sunset and palette controls - ${theme}`, async ({ page }) => {
      await setClientFlags(page, { theme, colorTheme: 'daybook' });
      await loginViaAPI(page, parentName);
      await verifySettingsViaAPI(page, parentName);
      await page.goto('/settings?section=display');
      await waitForStableUi(page, 700);
      await page.getByRole('button', { name: 'Sunset', exact: true }).click();
      await page.getByRole('button', { name: /Daybook/i }).first().click();
      await waitForStableUi(page, 250);

      await expect(page).toHaveScreenshot(`upstream-display-controls-${theme}.png`, SCREENSHOT_OPTIONS);
    });

    test(`calendar sync-health warning - ${theme}`, async ({ page }) => {
      await page.route('**/api/calendars/sync-health', async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ needsReauth: 1, providers: ['google'] }),
        });
      });
      await setClientFlags(page, { theme });
      await loginViaAPI(page, parentName);
      await page.goto('/calendar');
      await waitForStableUi(page, 800);
      await expect(page.getByRole('button', { name: 'Sync paused' })).toBeVisible();

      await expect(page).toHaveScreenshot(`upstream-calendar-sync-health-${theme}.png`, {
        ...SCREENSHOT_OPTIONS,
        mask: dynamicMasks(page),
      });
    });
  }

  test('screensaver and its in-place settings panel - dark', async ({ page }) => {
    await setClientFlags(page, {
      theme: 'dark',
      screensaverShortcut: true,
      screensaverMotion: 'off',
      screensaverTimeout: 0,
    });
    await loginViaAPI(page, parentName);
    await page.goto('/');
    await waitForStableUi(page, 700);
    await page.getByRole('button', { name: 'Start screensaver' }).click();
    await expect(page.getByRole('button', { name: 'Screensaver settings' })).toBeVisible();

    await expect(page).toHaveScreenshot('upstream-screensaver-dark.png', {
      ...SCREENSHOT_OPTIONS,
      mask: dynamicMasks(page),
    });

    await page.getByRole('button', { name: 'Screensaver settings' }).click();
    await expect(page.getByRole('heading', { name: 'Screensaver' })).toBeVisible();
    await expect(page).toHaveScreenshot('upstream-screensaver-settings-dark.png', {
      ...SCREENSHOT_OPTIONS,
      mask: dynamicMasks(page),
    });
  });

  test('mobile settings section selector - light', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setClientFlags(page, { theme: 'light' });
    await loginViaAPI(page, parentName);
    await verifySettingsViaAPI(page, parentName);
    await page.goto('/settings?section=display');
    await waitForStableUi(page, 700);
    await expect(page.locator('#settings-section-select')).toBeVisible();

    await expect(page).toHaveScreenshot('upstream-settings-mobile-display-light.png', SCREENSHOT_OPTIONS);
  });
});
