/**
 * Functional coverage for changes that commonly arrive with upstream syncs.
 *
 * This suite intentionally tests user-visible contracts rather than internal
 * implementation details: scoped links stay inside a dashboard, new scoped
 * routes render, sync-health warnings remain actionable, and display controls
 * persist across the separate settings/screensaver trees.
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from './helpers/auth';
import { resetAll } from './helpers/reset';
import {
  HAS_TEST_DB,
  getDefaultDashboardSlug,
  getSeededParentName,
  setClientFlags,
  verifySettingsViaAPI,
  waitForStableUi,
} from './helpers/upstream';

test.describe('Upstream regression contracts', () => {
  // Every worker would otherwise flush the shared seeded Redis session store
  // in its own beforeAll while another worker is using it.
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

  test('dashboard-scoped navigation stays inside the active layout', async ({ page }) => {
    await loginViaAPI(page, parentName);
    const slug = await getDefaultDashboardSlug(page);
    await page.goto(`/d/${slug}/weekend`);
    await waitForStableUi(page);

    await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible();
    const hrefs = await page.locator('a[href]').evaluateAll((anchors) =>
      anchors
        .map((anchor) => (anchor as HTMLAnchorElement).getAttribute('href'))
        .filter((href): href is string => Boolean(href)),
    );

    expect(hrefs.some((href) => href === `/d/${slug}/calendar`)).toBeTruthy();
    expect(hrefs.some((href) => href === `/d/${slug}/weekend`)).toBeTruthy();
    expect(hrefs.some((href) => href === '/calendar')).toBeFalsy();
  });

  for (const route of ['travel', 'weekend'] as const) {
    test(`scoped ${route} route renders its data surface`, async ({ page }) => {
      await loginViaAPI(page, parentName);
      const slug = await getDefaultDashboardSlug(page);
      const response = await page.goto(`/d/${slug}/${route}`);
      expect(response?.ok()).toBeTruthy();
      await waitForStableUi(page, 900);

      if (route === 'travel') {
        // MapLibre needs a real WebGL context, which is not available in every
        // developer container or headless CI host. The API contract plus the
        // successful scoped document response still verifies the new route
        // without making the suite depend on GPU availability.
        const pins = await page.request.get('/api/travel/pins');
        expect(pins.ok()).toBeTruthy();
        await expect(page).toHaveURL(new RegExp(`/d/${slug}/travel$`));
        await expect(page.locator('body')).not.toContainText('404');
      } else {
        await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible();
        await expect(page.getByPlaceholder('Search places…')).toBeVisible();
      }
    });
  }

  test('calendar sync-health warning links to calendar management', async ({ page }) => {
    await page.route('**/api/calendars/sync-health', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ needsReauth: 2, providers: ['google'] }),
      });
    });
    await loginViaAPI(page, parentName);
    await page.goto('/calendar');
    await waitForStableUi(page, 800);

    const warning = page.getByRole('button', { name: 'Sync paused (2)' });
    await expect(warning).toBeVisible();
    await expect(warning).toHaveAttribute('title', /reconnect/);
    await warning.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Manage calendars' })).toBeVisible();
  });

  test('display controls persist Sunset mode and palette shape variables', async ({ page }) => {
    await setClientFlags(page, { theme: 'light', colorTheme: 'daybook' });
    await loginViaAPI(page, parentName);
    await verifySettingsViaAPI(page, parentName);
    await page.goto('/settings?section=display');
    await waitForStableUi(page, 700);

    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
    await page.getByRole('button', { name: 'Sunset', exact: true }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('prism-theme'))).toBe('sunset');

    const shape = await page.evaluate(() => ({
      radius: getComputedStyle(document.documentElement).getPropertyValue('--radius').trim(),
      density: getComputedStyle(document.documentElement).getPropertyValue('--density').trim(),
      borderWidth: getComputedStyle(document.documentElement).getPropertyValue('--border-width').trim(),
    }));
    expect(shape.radius).not.toBe('');
    expect(shape.density).not.toBe('');
    expect(shape.borderWidth).not.toBe('');

    const palette = page.getByRole('button', { name: /Daybook/i }).first();
    await expect(palette).toHaveAttribute('aria-pressed', 'true');
  });

  test('mobile settings can switch sections through the responsive selector', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginViaAPI(page, parentName);
    await verifySettingsViaAPI(page, parentName);
    await page.goto('/settings?section=display');
    await waitForStableUi(page, 700);

    const selector = page.locator('#settings-section-select');
    await expect(selector).toBeVisible();
    await expect(selector).toHaveValue('display');
    await selector.selectOption('family');
    await expect(selector).toHaveValue('family');
    await expect(page.getByRole('heading', { name: 'Family' })).toBeVisible();
  });

  test('screensaver quick settings opens and writes motion preferences', async ({ page }) => {
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
    const settingsButton = page.getByRole('button', { name: 'Screensaver settings' });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    await expect(page.getByRole('heading', { name: 'Screensaver' })).toBeVisible();
    const effect = page.getByRole('combobox', { name: 'Transition effect' });
    await expect(effect).toHaveValue('off');
    await effect.selectOption('fade');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('prism-screensaver-motion'))).toBe('fade');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Screensaver' })).toBeHidden();
  });
});
