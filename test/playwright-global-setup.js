/**
 * Playwright globalSetup — runs once before webServer / tests.
 * Purges orphaned `table_state` rows left by prior multi-actor / subclass runs
 * so the Game Table nav does not show leftover tabs (e.g. "T12 Test Table").
 */
import {
  loadDotEnvForTestHelperOnly,
  cleanupOrphanedTestTables,
} from './helpers/cleanup-test-tables.js';

export default async function globalSetup() {
  loadDotEnvForTestHelperOnly();
  const result = await cleanupOrphanedTestTables();
  if (result.skipped) {
    console.log('[playwright-global-setup] skipped orphaned-table cleanup (no DATABASE_URL)');
    return;
  }
  const n = result.deletedTableIds.length;
  if (n === 0) {
    console.log('[playwright-global-setup] no orphaned test tables to delete');
    return;
  }
  console.log(
    `[playwright-global-setup] deleted ${n} orphaned test table(s) for GM uid(s): ${result.gmUserIds.join(', ')}`,
  );
}
