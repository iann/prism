import { execSync } from 'child_process';
import { expect, Page } from '@playwright/test';
import { getFamilyMembers } from './auth';

/**
 * Upstream-regression E2E tests must only run against the synthetic seed.
 * Apart from making the PIN deterministic, this prevents screenshots from
 * accidentally capturing names, addresses, or live photos.
 */
export const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';

export const SCREENSHOT_OPTIONS = {
  maxDiffPixelRatio: 0.01,
  animations: 'disabled' as const,
  fullPage: false,
};

/**
 * Pull a seeded parent's name directly from the DB. The public family API
 * intentionally redacts user ids before login, so this avoids coupling tests
 * to the login-index ordering.
 */
export function getSeededParentName(): string {
  const cmd = process.env.DATABASE_URL
    ? `psql "${process.env.DATABASE_URL}" -At -c "SELECT name FROM users WHERE role = 'parent' ORDER BY created_at LIMIT 1"`
    : `docker exec prism-db psql -U prism -d ${process.env.E2E_DB_NAME || 'prism'} -At -c "SELECT name FROM users WHERE role = 'parent' ORDER BY created_at LIMIT 1"`;
  const out = execSync(cmd, { encoding: 'utf-8' }).trim();
  if (!out) throw new Error('No seeded parent in DB — did seeds run?');
  return out;
}

/** Return the seeded default dashboard slug after the auth cookie is present. */
export async function getDefaultDashboardSlug(page: Page): Promise<string> {
  const response = await page.request.get('/api/layouts');
  expect(response.ok()).toBeTruthy();
  const data = await response.json() as { layouts?: Array<{ slug?: string | null }> };
  const slug = data.layouts?.find((layout) => layout.slug)?.slug;
  if (!slug) throw new Error('No dashboard slug returned by /api/layouts');
  return slug;
}

/** Verify the parent-only Settings gate after the normal display login. */
export async function verifySettingsViaAPI(page: Page, parentName: string) {
  const member = (await getFamilyMembers(page)).find((candidate) => candidate.name === parentName);
  if (!member) throw new Error(`No seeded parent named ${parentName}`);

  const data: Record<string, unknown> = { pin: process.env.E2E_PIN || '1234' };
  if (member.id) data.userId = member.id;
  else if (typeof member.loginIndex === 'number') data.memberIndex = member.loginIndex;
  else throw new Error(`Parent ${parentName} has neither id nor loginIndex`);

  const response = await page.request.post('/api/auth/verify-pin', { data });
  expect(response.ok()).toBeTruthy();
}

/** Set browser-only flags before the first app script executes. */
export async function setClientFlags(
  page: Page,
  opts: {
    theme?: 'light' | 'dark';
    perfMode?: boolean;
    colorTheme?: string;
    screensaverShortcut?: boolean;
    screensaverMotion?: 'off' | 'fade' | 'smoke' | 'liquid' | 'fireworks';
    screensaverTimeout?: number;
  } = {},
) {
  await page.addInitScript((flags) => {
    localStorage.setItem('prism-theme', flags.theme);
    localStorage.setItem('prism-perf-mode', String(flags.perfMode));
    localStorage.setItem('prism:auto-hide-ui', 'false');

    if (flags.colorTheme) localStorage.setItem('prism-color-theme', flags.colorTheme);
    if (flags.screensaverShortcut !== undefined) {
      localStorage.setItem('prism-screensaver-shortcut', flags.screensaverShortcut ? 'on' : 'off');
    }
    if (flags.screensaverMotion) localStorage.setItem('prism-screensaver-motion', flags.screensaverMotion);
    if (flags.screensaverTimeout !== undefined) {
      localStorage.setItem('prism-screensaver-timeout', String(flags.screensaverTimeout));
    }
  }, {
    theme: opts.theme ?? 'light',
    perfMode: opts.perfMode ?? false,
    colorTheme: opts.colorTheme,
    screensaverShortcut: opts.screensaverShortcut,
    screensaverMotion: opts.screensaverMotion,
    screensaverTimeout: opts.screensaverTimeout,
  });
}

/** Wait for fonts, lazy views, and the first client-side data pass to settle. */
export async function waitForStableUi(page: Page, delayMs = 500) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(delayMs);
}

/** Widgets with live values that should never be part of a screenshot diff. */
export function dynamicMasks(page: Page) {
  return [
    page.locator('[data-widget="Clock"]'),
    page.locator('[data-widget="Weather"]'),
    page.locator('[data-widget="Photo"]'),
  ];
}
