import { test, expect, type Page } from '@playwright/test';

// This spec touches only the seeded test service. Never run it against a
// household database; see e2e/calendar-geometry.spec.ts for the DB gate.
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';

async function mockDeliberateModes(page: Page) {
  // Keep a parallel Away/Babysitter mode spec from changing this page's state.
  const inactive = {
    enabled: false,
    enabledAt: null,
    enabledBy: null,
    disabledAt: null,
  };
  await page.route('**/api/away-mode', route => route.fulfill({ json: inactive }));
  await page.route('**/api/babysitter-mode', route => route.fulfill({ json: inactive }));
}

for (const [orientation, viewport] of [
  ['landscape', { width: 1280, height: 720 }],
  ['portrait', { width: 900, height: 1600 }],
] as const) {
  test.describe(`screen cleaning, ${orientation}`, () => {
    test.skip(!HAS_TEST_DB, 'needs the isolated seeded test database');
    test.use({ viewport, hasTouch: true });

    test('covers the viewport, blocks a dashboard action, and exits on Escape', async ({ page }) => {
      await page.clock.install({ time: new Date('2026-10-30T12:00:00.000Z') });
      await page.addInitScript(() => localStorage.setItem('prism-screensaver-timeout', '0'));
      await mockDeliberateModes(page);
      await page.goto('/');

      const trigger = page.getByRole('button', { name: 'Clean screen' });
      await expect(trigger).toBeVisible();
      await trigger.click();

      const shield = page.getByRole('dialog', { name: 'Screen cleaning' });
      await expect(shield).toBeVisible();
      const coversViewport = await page.evaluate(() => {
        const dialog = document.querySelector('[data-screen-cleaning-portal] [role="dialog"]');
        if (!dialog) return false;
        const points: Array<[number, number]> = [
          [0, 0], [window.innerWidth - 1, 0],
          [0, window.innerHeight - 1], [window.innerWidth - 1, window.innerHeight - 1],
          [window.innerWidth / 2, window.innerHeight / 2],
        ];
        return points.every(([x, y]) => dialog.contains(document.elementFromPoint(x, y)));
      });
      expect(coversViewport).toBe(true);

      // Dispatch directly on the covered button so hit-testing cannot make
      // this pass by selecting the shield alone. The window capture guard must
      // cancel the event before any button listener sees it.
      const clickResult = await page.evaluate(() => {
        const button = document.querySelector<HTMLButtonElement>('button[aria-label="Refresh page"]');
        if (!button) return null;
        let reachedButton = false;
        button.addEventListener('click', () => { reachedButton = true; }, { once: true });
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        button.dispatchEvent(event);
        return { reachedButton, defaultPrevented: event.defaultPrevented };
      });
      expect(clickResult).toEqual({ reachedButton: false, defaultPrevented: true });
      await expect(shield).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(shield).toBeHidden({ timeout: 3_000 });
    });

    test('returns automatically at the 60-second deadline', async ({ page }) => {
      await page.clock.install({ time: new Date('2026-10-30T12:00:00.000Z') });
      await page.addInitScript(() => localStorage.setItem('prism-screensaver-timeout', '0'));
      await mockDeliberateModes(page);
      await page.goto('/');
      await page.getByRole('button', { name: 'Clean screen' }).click();

      const shield = page.getByRole('dialog', { name: 'Screen cleaning' });
      await expect(shield).toBeVisible();
      await page.clock.fastForward(60_000);
      await expect(shield).toBeHidden({ timeout: 3_000 });
    });

    if (orientation === 'landscape') {
      test('holds a real browser touch through expiry and its trailing click', async ({ page }) => {
        await page.clock.install({ time: new Date('2026-10-30T12:00:00.000Z') });
        await page.addInitScript(() => localStorage.setItem('prism-screensaver-timeout', '0'));
        await mockDeliberateModes(page);
        await page.goto('/');
        await page.getByRole('button', { name: 'Clean screen' }).click();

        const shield = page.getByRole('dialog', { name: 'Screen cleaning' });
        await expect(shield).toBeVisible();
        const refreshBox = await page.getByRole('button', { name: 'Refresh page' }).boundingBox();
        expect(refreshBox).not.toBeNull();
        const x = refreshBox!.x + refreshBox!.width / 2;
        const y = refreshBox!.y + refreshBox!.height / 2;
        await page.evaluate(() => {
          (window as Window & { __cleaningInputEvents?: number }).__cleaningInputEvents = 0;
          const count = () => {
            const target = window as Window & { __cleaningInputEvents?: number };
            target.__cleaningInputEvents = (target.__cleaningInputEvents || 0) + 1;
          };
          window.addEventListener('pointerdown', count, true);
          window.addEventListener('pointermove', count, true);
          window.addEventListener('pointerup', count, true);
        });

        const client = await page.context().newCDPSession(page);
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 }],
        });
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x + 70, y: y + 40, id: 1, radiusX: 2, radiusY: 2, force: 1 }],
        });
        await page.clock.fastForward(60_000);
        await expect(shield.getByText('Lift your hand or cloth to finish')).toBeVisible();
        expect(await page.evaluate(() => (window as Window & { __cleaningInputEvents?: number }).__cleaningInputEvents)).toBe(0);

        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.clock.fastForward(700);
        await expect(shield).toBeHidden({ timeout: 3_000 });
        await client.detach();
      });
    }
  });
}
