import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Global teardown: sweep any leftover E2E test data from the database.
 * Runs after all Playwright tests finish, catching anything that
 * per-test afterEach cleanup may have missed.
 */
function runSQL(sql: string) {
  const tmpFile = join(tmpdir(), `prism-e2e-teardown-${Date.now()}.sql`);
  writeFileSync(tmpFile, sql, 'utf-8');
  try {
    if (process.env.DATABASE_URL && hasCommand('psql')) {
      execFileSync('psql', [process.env.DATABASE_URL, '-f', tmpFile], { stdio: 'pipe' });
    } else {
      execFileSync('docker', ['exec', '-i', 'prism-db', 'psql', '-U', 'prism', '-d', 'prism'], {
        input: readFileSync(tmpFile),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

function hasCommand(command: string): boolean {
  try {
    execFileSync(command, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export default function globalTeardown() {
  try {
    runSQL(`
      DELETE FROM chore_completions WHERE chore_id IN (SELECT id FROM chores WHERE title LIKE 'E2E %');
      DELETE FROM chores WHERE title LIKE 'E2E %';
      DELETE FROM tasks WHERE title LIKE 'E2E %';
      DELETE FROM events WHERE title LIKE 'E2E %';
      DELETE FROM shopping_items WHERE name LIKE 'E2E %';
      DELETE FROM shopping_lists WHERE name LIKE 'E2E %';
    `);
  } catch {
    // DB may not be running (e.g. CI without Docker) — don't fail teardown
    console.warn('[global-teardown] Could not clean up E2E data (DB unavailable)');
  }
}
