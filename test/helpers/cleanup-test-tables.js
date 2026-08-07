/**
 * Purge orphaned Game Tables owned by Playwright multi-actor / subclass GM
 * identities (`test-user-uid`, `test-user-uid-<ns>`, …).
 *
 * Those suites share a fixed GM uid against a real Postgres DB. When
 * `afterAll` → `deleteTestTable` is skipped (crash, interrupt, failed DELETE),
 * leftover `table_state` rows keep showing up in the nav chrome of later runs
 * (e.g. "T12 Test Table" across subclass video screencasts).
 *
 * Used by Playwright `globalSetup` (before webServer / tests). No-ops when
 * `DATABASE_URL` is unset (CI without a DB).
 */

import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const { Pool } = pg;

/** Same `.env` load pattern as `multi-auth.js` (Playwright parent does not use `--env-file`). */
export function loadDotEnvForTestHelperOnly() {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env');
  if (!existsSync(envPath)) return;
  let text;
  try {
    text = readFileSync(envPath, 'utf8');
  } catch {
    return;
  }
  for (let line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice(7).trim();
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    val = val.replace(/\s+#.*$/, '').trim();
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}

/**
 * True for the default multi-actor GM and any namespaced variant
 * (`TEST_ACTOR_NS`, `SUBCLASS_PARALLEL` worker suffix).
 */
export function isTestGmUserId(userId) {
  if (typeof userId !== 'string' || !userId) return false;
  return userId === 'test-user-uid' || userId.startsWith('test-user-uid-');
}

/**
 * When `TEST_ACTOR_NS` is set (parallel Cursor agents, each with their own
 * PLAYWRIGHT_TEST_PORT), only purge that namespace's GM tables so one agent's
 * globalSetup cannot DELETE another agent's in-flight `table_state` rows.
 * Unset → legacy: all `test-user-uid` / `test-user-uid-*` owners.
 *
 * @param {string | undefined} [actorNs]
 * @returns {{ sql: string, params: string[] }}
 */
export function buildTestGmTableOwnerFilter(actorNs = process.env.TEST_ACTOR_NS) {
  const ns = typeof actorNs === 'string' ? actorNs.trim() : '';
  if (!ns) {
    // Default / CI: bare GM + SUBCLASS_PARALLEL workers (`test-user-uid-w0`, …).
    // Do NOT use `test-user-uid-%` — that wipes parallel Cursor agents that set
    // TEST_ACTOR_NS (e.g. `test-user-uid-guardian-p1`) mid-run via their globalSetup.
    return {
      sql: `(user_id = $2 OR user_id ~ $3)`,
      params: ['test-user-uid', '^test-user-uid-w[0-9]+(-.*)?$'],
    };
  }
  const exact = `test-user-uid-${ns}`;
  return {
    sql: `(user_id = $2 OR user_id LIKE $3)`,
    params: [exact, `${exact}-%`],
  };
}

/**
 * Delete every `table_state` row owned by a test GM uid, plus related
 * placement / campaign-pass rows for those table ids.
 *
 * @param {{ query: (sql: string, params?: unknown[]) => Promise<{ rows: object[], rowCount?: number }> }} db
 * @param {string} [appId]
 * @param {{ actorNs?: string }} [opts] — override `TEST_ACTOR_NS` scoping (tests)
 * @returns {Promise<{ deletedTableIds: string[], gmUserIds: string[] }>}
 */
export async function cleanupOrphanedTestTablesWithDb(db, appId = 'daggerheart-gm-tool', opts = {}) {
  const ownerFilter = buildTestGmTableOwnerFilter(opts.actorNs ?? process.env.TEST_ACTOR_NS);
  const { rows: tableRows } = await db.query(
    `SELECT id, user_id
       FROM items
      WHERE app_id = $1
        AND collection = 'table_state'
        AND ${ownerFilter.sql}`,
    [appId, ...ownerFilter.params],
  );

  const deletedTableIds = tableRows.map((r) => r.id);
  const gmUserIds = [...new Set(tableRows.map((r) => r.user_id))];

  if (deletedTableIds.length === 0) {
    return { deletedTableIds, gmUserIds };
  }

  await db.query(
    `DELETE FROM character_table_placements
      WHERE app_id = $1 AND table_id = ANY($2::text[])`,
    [appId, deletedTableIds],
  );

  await db.query(
    `DELETE FROM table_campaign_passes
      WHERE app_id = $1 AND table_id = ANY($2::text[])`,
    [appId, deletedTableIds],
  );

  await db.query(
    `DELETE FROM items
      WHERE app_id = $1
        AND collection = 'table_state'
        AND id = ANY($2::text[])`,
    [appId, deletedTableIds],
  );

  return { deletedTableIds, gmUserIds };
}

/**
 * Connect via `DATABASE_URL`, purge orphaned test GM tables, then end the pool.
 * No-ops (returns empty result) when `DATABASE_URL` is unset.
 */
export async function cleanupOrphanedTestTables({
  connectionString = process.env.DATABASE_URL,
  appId = process.env.APP_ID || 'daggerheart-gm-tool',
} = {}) {
  if (!connectionString) {
    return { deletedTableIds: [], gmUserIds: [], skipped: true };
  }

  const pool = new Pool({ connectionString });
  try {
    const result = await cleanupOrphanedTestTablesWithDb(pool, appId);
    return { ...result, skipped: false };
  } finally {
    await pool.end().catch(() => {});
  }
}
