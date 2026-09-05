import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Run SQL against the Prism database.
 *
 * Two execution paths because dev and CI hold the DB differently:
 *   - Local (Windows dev): postgres lives in the `prism-db` Docker container;
 *     `psql` may not be installed on the host. Reach in via `docker exec`.
 *   - CI: postgres is a GitHub Actions service container exposed on
 *     localhost:5432; the runner has `psql`. Use DATABASE_URL directly.
 */
function runSQL(sql: string) {
  const tmpFile = join(tmpdir(), `prism-e2e-${Date.now()}.sql`);
  writeFileSync(tmpFile, sql, 'utf-8');
  try {
    if (process.env.DATABASE_URL && hasCommand('psql')) {
      execFileSync('psql', [process.env.DATABASE_URL, '-f', tmpFile], { stdio: 'pipe' });
    } else {
      const dbName = process.env.E2E_DB_NAME || 'prism';
      execFileSync('docker', ['exec', '-i', 'prism-db', 'psql', '-U', 'prism', '-d', dbName], {
        input: readFileSync(tmpFile),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/**
 * Flush Redis to clear sessions and caches.
 */
function flushRedis() {
  if (process.env.REDIS_URL && hasCommand('redis-cli')) {
    execFileSync('redis-cli', ['-u', process.env.REDIS_URL, 'FLUSHDB'], { stdio: 'pipe' });
  } else {
    execFileSync('docker', ['exec', 'prism-redis', 'redis-cli', 'FLUSHDB'], { stdio: 'pipe' });
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

/**
 * Reset tasks to seed state (uncomplete all except known-completed ones).
 */
export function resetTasks() {
  runSQL(`
    UPDATE tasks SET completed = false, completed_at = NULL, completed_by = NULL
      WHERE completed = true;
  `);
}

/**
 * Reset all shopping items to unchecked.
 */
export function resetShoppingItems() {
  runSQL(`UPDATE shopping_items SET checked = false;`);
}

/**
 * Clear recent chore completions (last day).
 */
export function resetChoreCompletions() {
  runSQL(`DELETE FROM chore_completions WHERE completed_at > now() - interval '1 day';`);
}

/**
 * Disable away mode and babysitter mode.
 */
export function resetModes() {
  runSQL(`DELETE FROM settings WHERE key IN ('awayMode', 'babysitterMode');`);
}

/**
 * Full reset: flush Redis + reset all test-relevant data.
 */
export function resetAll() {
  flushRedis();
  resetTasks();
  resetShoppingItems();
  resetChoreCompletions();
  resetModes();
}
