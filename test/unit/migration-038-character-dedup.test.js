/**
 * Regression test for the production incident where migration
 * 038_characters_id_unique.sql failed at startup with:
 *   "could not create unique index items_characters_id_unique"
 *
 * Root cause: duplicate (app_id, id) rows in the `characters` collection can
 * still appear between a manual reconciliation pass
 * (scripts/reconcile-character-ownership.mjs) and this migration actually
 * running in production (e.g. the old duplicate-creating code path is still
 * live during a rolling deploy). The migration must be self-healing: it
 * archives any remaining duplicates (keeping the most-recently-updated row,
 * preserving the others' data under a synthetic id) immediately before
 * creating the unique index, so startup never fails on this migration
 * regardless of timing.
 *
 * Runs against a real Postgres connection (skipped when DATABASE_URL is
 * unset, e.g. in CI — see .github/workflows/ci.yml). Everything happens
 * inside one transaction that is rolled back at the end, so the test never
 * mutates persistent DB state (including the real unique index, which is
 * dropped and recreated only within the rolled-back transaction).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_SQL = readFileSync(
  join(__dirname, '../../migrations/038_characters_id_unique.sql'),
  'utf8',
);

describe('migration 038 SQL content', () => {
  it('archives duplicates before creating the unique index (self-healing)', () => {
    expect(MIGRATION_SQL).toMatch(/ROW_NUMBER\(\)/i);
    expect(MIGRATION_SQL).toMatch(/PARTITION BY app_id, id/i);
    expect(MIGRATION_SQL).toMatch(/_archivedDuplicateOf_/);
    expect(MIGRATION_SQL).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS items_characters_id_unique/i);
    // The dedup step must run before the index creation, not after.
    const dedupIdx = MIGRATION_SQL.search(/_archivedDuplicateOf_/);
    const indexIdx = MIGRATION_SQL.search(/CREATE UNIQUE INDEX/i);
    expect(dedupIdx).toBeGreaterThan(-1);
    expect(indexIdx).toBeGreaterThan(dedupIdx);
  });
});

describe.skipIf(!process.env.DATABASE_URL)('LIVE Postgres: migration 038 self-heals duplicate characters', () => {
  let pg;
  let client;
  const appId = `test-migration-038-${Date.now()}`;

  beforeAll(async () => {
    pg = (await import('pg')).default;
    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('keeps the newest row canonical and archives the rest without data loss', async () => {
    await client.query('BEGIN');
    try {
      // Simulate production: the unique index already exists from a prior
      // successful deploy, but a duplicate slipped in before this run.
      await client.query('DROP INDEX IF EXISTS items_characters_id_unique');

      const charId = `${appId}-char-1`;
      await client.query(
        `INSERT INTO items (app_id, user_id, collection, id, data, updated_at)
         VALUES ($1, 'gm-uid', 'characters', $2, $3, now() - interval '1 hour')`,
        [appId, charId, JSON.stringify({ name: 'Older Copy', level: 3 })],
      );
      await client.query(
        `INSERT INTO items (app_id, user_id, collection, id, data, updated_at)
         VALUES ($1, 'player-uid', 'characters', $2, $3, now())`,
        [appId, charId, JSON.stringify({ name: 'Newer Copy', level: 5 })],
      );

      // Run the actual migration file content.
      await client.query(MIGRATION_SQL);

      // Exactly one row remains at the canonical id, and it's the newest one.
      const { rows: canonical } = await client.query(
        `SELECT user_id, data FROM items WHERE app_id = $1 AND collection = 'characters' AND id = $2`,
        [appId, charId],
      );
      expect(canonical).toHaveLength(1);
      expect(canonical[0].user_id).toBe('player-uid');
      expect(canonical[0].data.name).toBe('Newer Copy');

      // The older row was archived, not deleted — data is preserved.
      const { rows: archived } = await client.query(
        `SELECT user_id, data FROM items
         WHERE app_id = $1 AND collection = 'characters' AND id LIKE $2`,
        [appId, `_archivedDuplicateOf_${charId}_%`],
      );
      expect(archived).toHaveLength(1);
      expect(archived[0].user_id).toBe('gm-uid');
      expect(archived[0].data.name).toBe('Older Copy');
      expect(archived[0].data._archivedDuplicateOf).toBe(charId);

      // The unique index now exists and holds.
      const { rows: idx } = await client.query(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'items_characters_id_unique'`,
      );
      expect(idx).toHaveLength(1);

      // Re-running the migration is a no-op (idempotent) since no duplicates remain.
      await expect(client.query(MIGRATION_SQL)).resolves.toBeDefined();
    } finally {
      await client.query('ROLLBACK');
    }
  });
});
