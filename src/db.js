import pg from 'pg';
import { COLLECTION_NAMES as SRD_COLLECTION_NAMES, searchCollection as searchSrdCollection } from './srd/parser.js';
import { unifiedListConfig } from './unified-list-config.js';
import {
  resolveLibraryAllBranchTiers,
  resolveLibraryAllBranchTypes,
  shouldIncludeLibraryAllBranch,
} from './library-all-branch-opts.js';
import { countFeatureCatalog, filterFeatureCatalog } from './v2-feature-catalog.js';
import { FCG_PUBLIC_USER_ID } from './game-constants.js';
import { normalizePersistedCharacterElement } from './client/lib/normalize-persisted-character-element.js';
import { attachDerivedMapConfig } from './client/lib/map-table-state.js';
import { mergeUserPreferencesData, normalizeUserPreferences } from './user-preferences.js';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'node:crypto';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

/** Stores canonical copies of external (SRD played/cloned, etc.) items for local-first search and popularity tracking. */
export const MIRROR_USER_ID = '__MIRROR__';
const DIRECT_SRD_COLLECTIONS = new Set(['campaign_frames', 'rules']);

export { FCG_PUBLIC_USER_ID };

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function runMigrations() {
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows: applied } = await db.query('SELECT name FROM _migrations');
  const appliedSet = new Set(applied.map(r => r.name));

  const files = (await readdir(MIGRATIONS_DIR))
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[db] Applied migration: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
}

// --- Query helpers ---

export async function getItems(appId, userId, collection) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT id, data, is_public FROM items
     WHERE app_id = $1 AND user_id = $2 AND collection = $3
     ORDER BY created_at ASC`,
    [appId, userId, collection]
  );
  return rows.map(r => ({ id: r.id, ...r.data, is_public: r.is_public }));
}

export async function getPublicItems(appId, excludeUserId, collection) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT id, user_id, data,
       COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'clone'), 0) AS clone_count,
       COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'play'), 0) AS play_count
     FROM items i
     WHERE app_id = $1 AND user_id != $2 AND collection = $3 AND is_public = true
     ORDER BY created_at ASC`,
    [appId, excludeUserId, collection]
  );
  return rows.map(r => ({ id: r.id, ...r.data, is_public: true, clone_count: r.clone_count, play_count: r.play_count, _source: 'public', _owner: r.user_id }));
}

// --- Filter / community SQL builders ---

/**
 * Builds additional WHERE clauses for search text, tier, and type value.
 * @param {number} baseParamCount  Number of positional params already in the query.
 * @param {number|null} tierMax    When set (includeScaledUp), filter tier <= tierMax instead of exact match.
 * @param {number[]} tiers         Multi-select: filter tier IN (tiers). Empty = no filter.
 * @param {string[]} typeValues   Multi-select: filter typeField IN (typeValues). Empty = no filter.
 */
function buildFilterSQL(baseParamCount, { search = '', tier = null, tierMax = null, tiers = [], typeField = null, typeValue = null, typeValues = [] } = {}) {
  const clauses = [];
  const params = [];
  let idx = baseParamCount + 1;

  if (search) {
    clauses.push(`data->>'name' ILIKE '%' || $${idx} || '%'`);
    params.push(search);
    idx++;
  }
  if (tierMax != null) {
    clauses.push(`(data->>'tier')::int <= $${idx}`);
    params.push(Number(tierMax));
    idx++;
  } else if (Array.isArray(tiers) && tiers.length > 0) {
    const tierStrs = tiers.map(t => String(t));
    clauses.push(`data->>'tier' = ANY($${idx}::text[])`);
    params.push(tierStrs);
    idx++;
  } else if (tier != null) {
    clauses.push(`data->>'tier' = $${idx}`);
    params.push(String(tier));
    idx++;
  }
  if (typeField && Array.isArray(typeValues) && typeValues.length > 0) {
    clauses.push(`data->>'${typeField}' = ANY($${idx}::text[])`);
    params.push(typeValues.map(v => String(v)));
    idx++;
  } else if (typeField && typeValue) {
    clauses.push(`data->>'${typeField}' = $${idx}`);
    params.push(typeValue);
    idx++;
  }

  return { sql: clauses.length > 0 ? 'AND ' + clauses.join(' AND ') : '', params };
}

/**
 * Builds WHERE clauses that restrict to the community sources (public, mirrors)
 * while applying standard search filters.
 *
 * The base query must already bind app_id ($1) and collection ($2).
 * baseParamCount = 2.
 *
 * Returns { sql, params } where params does NOT include the fixed app_id/collection values.
 */
function buildCommunitySQL(baseParamCount, {
  includePublic = true,
  includeMirrors = true,
  excludeUserId = null,
  search = '',
  tier = null,
  tierMax = null,
  tiers = [],
  typeField = null,
  typeValue = null,
  typeValues = [],
} = {}) {
  const extraParams = [];
  const sourceClauses = [];
  let idx = baseParamCount + 1;

  if (includePublic && excludeUserId != null) {
    sourceClauses.push(`(is_public = true AND user_id != $${idx} AND user_id != '${MIRROR_USER_ID}')`);
    extraParams.push(excludeUserId);
    idx++;
  }
  if (includeMirrors) {
    sourceClauses.push(`user_id = '${MIRROR_USER_ID}'`);
  }

  const sourceSQL = sourceClauses.length > 0
    ? `AND (${sourceClauses.join(' OR ')})`
    : 'AND FALSE';

  const { sql: filterSQL, params: filterParams } = buildFilterSQL(baseParamCount + extraParams.length, { search, tier, tierMax, tiers, typeField, typeValue, typeValues });

  return { sql: sourceSQL + ' ' + filterSQL, params: [...extraParams, ...filterParams] };
}

// --- Own-item paginated helpers ---

export async function countItems(appId, userId, collection, { search = '', tier = null, tierMax = null, tiers = [], typeField = null, typeValue = null, typeValues = [] } = {}) {
  const db = getPool();
  const base = [appId, userId, collection];
  const { sql, params: fp } = buildFilterSQL(base.length, { search, tier, tierMax, tiers, typeField, typeValue, typeValues });
  const { rows } = await db.query(
    `SELECT COUNT(*) FROM items WHERE app_id = $1 AND user_id = $2 AND collection = $3 ${sql}`,
    [...base, ...fp]
  );
  return parseInt(rows[0].count, 10);
}

export async function getItemsPaginated(appId, userId, collection, { search = '', tier = null, tierMax = null, tiers = [], typeField = null, typeValue = null, typeValues = [], offset = 0, limit = 20 } = {}) {
  const db = getPool();
  const base = [appId, userId, collection];
  const { sql, params: fp } = buildFilterSQL(base.length, { search, tier, tierMax, tiers, typeField, typeValue, typeValues });
  const offsetIdx = base.length + fp.length + 1;
  const limitIdx = offsetIdx + 1;
  const popExpr = `(COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'clone'), 0) + COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'play'), 0))`;
  const { rows } = await db.query(
    `SELECT i.id, i.data, i.is_public,
       COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'clone'), 0) AS clone_count,
       COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'play'), 0) AS play_count
     FROM items i
     WHERE i.app_id = $1 AND i.user_id = $2 AND i.collection = $3 ${sql}
     ORDER BY ${popExpr} DESC, i.data->>'name' ASC
     OFFSET $${offsetIdx} LIMIT $${limitIdx}`,
    [...base, ...fp, offset, limit]
  );
  return rows.map(r => ({ id: r.id, ...r.data, is_public: r.is_public, clone_count: r.clone_count, play_count: r.play_count, _source: 'own' }));
}

// --- Community (SRD + public + mirrors) paginated helpers ---

export async function countCommunityItems(appId, collection, {
  excludeUserId = null,
  includePublic = true,
  includeMirrors = true,
  search = '',
  tier = null,
  tierMax = null,
  tiers = [],
  typeField = null,
  typeValue = null,
  typeValues = [],
} = {}) {
  const db = getPool();
  const base = [appId, collection];
  const { sql, params: cp } = buildCommunitySQL(base.length, { includePublic, includeMirrors, excludeUserId, search, tier, tierMax, tiers, typeField, typeValue, typeValues });
  const { rows } = await db.query(
    `SELECT COUNT(*) FROM items WHERE app_id = $1 AND collection = $2 ${sql}`,
    [...base, ...cp]
  );
  return parseInt(rows[0].count, 10);
}

export async function getCommunityItemsPaginated(appId, collection, {
  excludeUserId = null,
  includePublic = true,
  includeMirrors = true,
  search = '',
  tier = null,
  tierMax = null,
  tiers = [],
  typeField = null,
  typeValue = null,
  typeValues = [],
  offset = 0,
  limit = 20,
} = {}) {
  const db = getPool();
  const base = [appId, collection];
  const { sql, params: cp } = buildCommunitySQL(base.length, { includePublic, includeMirrors, excludeUserId, search, tier, tierMax, tiers, typeField, typeValue, typeValues });
  const offsetIdx = base.length + cp.length + 1;
  const limitIdx = offsetIdx + 1;
  const popExpr = `(COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'clone'), 0) + COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'play'), 0))`;
  const { rows } = await db.query(
    `SELECT i.id, i.user_id, i.data, i.is_public,
       COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'clone'), 0) AS clone_count,
       COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'play'), 0) AS play_count
     FROM items i
     WHERE i.app_id = $1 AND i.collection = $2 ${sql}
     ORDER BY ${popExpr} DESC, i.data->>'name' ASC
     OFFSET $${offsetIdx} LIMIT $${limitIdx}`,
    [...base, ...cp, offset, limit]
  );
  return rows.map(r => {
    const source = r.user_id === MIRROR_USER_ID ? (r.data._source || 'mirror') : 'public';
    const owner = source === 'public' ? r.user_id : undefined;
    return {
      id: r.id,
      ...r.data,
      is_public: r.is_public,
      clone_count: r.clone_count,
      play_count: r.play_count,
      _source: source,
      ...(owner ? { _owner: owner } : {}),
    };
  });
}

/**
 * Returns the IDs of all mirror items matching the given search filters.
 * Used to dedup live external API results that already exist as mirrors.
 */
export async function getMirrorIds(appId, collection, { search = '', tier = null, tierMax = null, tiers = [], typeField = null, typeValue = null, typeValues = [] } = {}) {
  const db = getPool();
  const base = [appId, MIRROR_USER_ID, collection];
  const { sql, params: fp } = buildFilterSQL(base.length, { search, tier, tierMax, tiers, typeField, typeValue, typeValues });
  const { rows } = await db.query(
    `SELECT id FROM items WHERE app_id = $1 AND user_id = $2 AND collection = $3 ${sql}`,
    [...base, ...fp]
  );
  return rows.map(r => r.id);
}

// --- Popularity helpers (item_popularity table) ---

/**
 * Record a clone action. Idempotent per user (ON CONFLICT DO NOTHING).
 */
export async function recordClone(appId, userId, collection, itemId) {
  const db = getPool();
  await db.query(
    `INSERT INTO item_popularity (app_id, collection, item_id, user_id, action)
     VALUES ($1, $2, $3, $4, 'clone')
     ON CONFLICT (app_id, collection, item_id, user_id, action) DO NOTHING`,
    [appId, userId, collection, itemId]
  );
}

/**
 * Record a play action. Idempotent per user (ON CONFLICT DO NOTHING).
 */
export async function recordPlay(appId, userId, collection, itemId) {
  const db = getPool();
  await db.query(
    `INSERT INTO item_popularity (app_id, collection, item_id, user_id, action)
     VALUES ($1, $2, $3, $4, 'play')
     ON CONFLICT (app_id, collection, item_id, user_id, action) DO NOTHING`,
    [appId, userId, collection, itemId]
  );
}

/** @deprecated Use recordClone/recordPlay. Kept for migration period. */
export async function incrementCloneCount(appId, collection, id) {
  // No-op: popularity now tracked in item_popularity
}

/** @deprecated Use recordClone/recordPlay. Kept for migration period. */
export async function incrementPlayCount(appId, collection, id) {
  // No-op: popularity now tracked in item_popularity
}

/**
 * Upsert a mirror row for an external item (legacy: used during transition).
 * New architecture uses external_item_cache; mirrors in items are deprecated.
 */
export async function upsertMirror(appId, collection, id, data, { cloneDelta = 0, playDelta = 0 } = {}) {
  const db = getPool();
  const { rows } = await db.query(
    `INSERT INTO items (id, app_id, user_id, collection, data, is_public)
     VALUES ($1, $2, $3, $4, $5, false)
     ON CONFLICT (app_id, user_id, collection, id)
     DO UPDATE SET data = EXCLUDED.data, updated_at = now()
     RETURNING id`,
    [id, appId, MIRROR_USER_ID, collection, data]
  );
  return rows[0];
}

/**
 * Find a user's existing auto-clone of a source item (matched via _clonedFrom).
 * Returns the clone row or null.
 */
export async function findAutoClone(appId, userId, collection, sourceId) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT i.id, i.data, i.is_public,
       COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'clone'), 0) AS clone_count,
       COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'play'), 0) AS play_count
     FROM items i
     WHERE i.app_id = $1 AND i.user_id = $2 AND i.collection = $3
       AND i.data->>'_clonedFrom' = $4
     LIMIT 1`,
    [appId, userId, collection, sourceId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, ...r.data, is_public: r.is_public, clone_count: r.clone_count, play_count: r.play_count, _source: 'own' };
}

// --- Resolve by IDs ---

/**
 * Fetch a single item by ID for the given user.
 * Returns the item or null if not found.
 */
export async function getItem(appId, userId, collection, id) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT id, data, is_public FROM items
     WHERE app_id = $1 AND user_id = $2 AND collection = $3 AND id = $4
     LIMIT 1`,
    [appId, userId, collection, id]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, ...r.data, is_public: r.is_public };
}

/**
 * @param {{ withPopularity?: boolean }} [opts] — `withPopularity: false` skips the two
 *   correlated `item_popularity` subqueries (clone_count/play_count) for call sites that
 *   don't use them, e.g. character-element resolution on the Game Table hot path.
 */
export async function getItemsByIds(appId, collection, ids, opts = {}) {
  if (!ids || ids.length === 0) return [];
  const withPopularity = opts.withPopularity !== false;
  const db = getPool();
  const { rows } = await db.query(
    withPopularity
      ? `SELECT i.id, i.user_id, i.data, i.is_public,
           COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'clone'), 0) AS clone_count,
           COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'play'), 0) AS play_count
         FROM items i
         WHERE i.app_id = $1 AND i.collection = $2 AND i.id = ANY($3)`
      : `SELECT i.id, i.user_id, i.data, i.is_public
         FROM items i
         WHERE i.app_id = $1 AND i.collection = $2 AND i.id = ANY($3)`,
    [appId, collection, ids]
  );
  return rows.map(r => {
    const source = r.user_id === MIRROR_USER_ID ? (r.data._source || 'mirror')
      : r.is_public ? 'public'
      : 'own';
    return {
      id: r.id,
      ...r.data,
      is_public: r.is_public,
      ...(withPopularity ? { clone_count: r.clone_count, play_count: r.play_count } : {}),
      _source: source,
      ...(source === 'public' ? { _owner: r.user_id } : {}),
    };
  });
}

export async function upsertItem(appId, userId, collection, id, data, isPublic = false) {
  const db = getPool();
  const { rows } = await db.query(
    `INSERT INTO items (id, app_id, user_id, collection, data, is_public)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (app_id, user_id, collection, id)
     DO UPDATE SET data = $5, is_public = $6, updated_at = now()
     RETURNING id`,
    [id, appId, userId, collection, data, isPublic]
  );
  if (collection === 'characters') invalidateCharacterLibraryCache(appId, id);
  return rows[0].id;
}

export async function deleteItem(appId, userId, collection, id) {
  const db = getPool();
  await db.query(
    `DELETE FROM items
     WHERE app_id = $1 AND user_id = $2 AND collection = $3 AND id = $4`,
    [appId, userId, collection, id]
  );
  if (collection === 'characters') invalidateCharacterLibraryCache(appId, id);
}

// --- Canonical character helpers (table-scoped, user-agnostic) ---

/**
 * Fetch a single character row by id, ignoring user_id.
 * Returns the merged item object (id + data fields) or null if not found.
 * When multiple rows exist for the same id (legacy duplicates), returns the most recently updated.
 */
export async function getCharacterById(appId, id) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT id, user_id, table_id, data, is_public, updated_at
     FROM items
     WHERE app_id = $1 AND collection = 'characters' AND id = $2
     ORDER BY updated_at DESC NULLS LAST, user_id
     LIMIT 1`,
    [appId, id]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, user_id: r.user_id, table_id: r.table_id, ...r.data, is_public: r.is_public };
}

/**
 * Upsert a character row using a single canonical row per id (user-agnostic).
 *
 * - If a row exists for this (app_id, collection='characters', id): updates data + table_id in place,
 *   regardless of which user_id owns the row. Returns 409-style error if table_id is already set
 *   to a *different* non-null value.
 * - If no row exists: inserts under requesterUid with table_id = tableId.
 *
 * This prevents the "shadow row" bug where player saves create a second row under their own uid.
 */
export async function upsertCharacterForTable(appId, { requesterUid, tableId, id, data, isPublic = false }) {
  // #region agent log
  try { (await import('node:fs')).appendFileSync('/Users/andrewreutter/Repos/DaggerheartGM/.cursor/debug-167b91.log', JSON.stringify({sessionId:'167b91',runId:'post-fix',hypothesisId:'C',location:'src/db.js:495',message:'upsertCharacterForTable (server library write)',data:{id,tableId,name:data?.name??null},timestamp:Date.now()})+'\n'); } catch {}
  // #endregion
  const db = getPool();
  const existing = await getCharacterById(appId, id);
  if (existing) {
    if (existing.table_id && existing.table_id !== tableId) {
      const err = new Error(`Character ${id} belongs to table ${existing.table_id}, not ${tableId}`);
      err.statusCode = 409;
      throw err;
    }
    await db.query(
      `UPDATE items
       SET data = $1, is_public = $2, table_id = $3, updated_at = now()
       WHERE app_id = $4 AND collection = 'characters' AND id = $5`,
      [data, isPublic, tableId, appId, id]
    );
  } else {
    await db.query(
      `INSERT INTO items (id, app_id, user_id, collection, data, is_public, table_id)
       VALUES ($1, $2, $3, 'characters', $4, $5, $6)`,
      [id, appId, requesterUid, data, isPublic, tableId]
    );
  }
  invalidateCharacterLibraryCache(appId, id);
}

/**
 * Delete a character row by id, ignoring user_id (canonical unscoped delete).
 */
export async function deleteCharacterForTable(appId, id) {
  const db = getPool();
  await db.query(
    `DELETE FROM items WHERE app_id = $1 AND collection = 'characters' AND id = $2`,
    [appId, id]
  );
  invalidateCharacterLibraryCache(appId, id);
}

/**
 * Stamp table_id on a character row if it is not already set (or already matches).
 * Safe to call any time a character is placed on a table; never overwrites an existing table_id
 * with a different value — returns false if there was a conflict (existing different table_id).
 */
export async function stampCharacterTableId(appId, id, tableId) {
  const db = getPool();
  const { rowCount } = await db.query(
    `UPDATE items SET table_id = $1
     WHERE app_id = $2 AND collection = 'characters' AND id = $3
       AND (table_id IS NULL OR table_id = $1)`,
    [tableId, appId, id]
  );
  return rowCount > 0;
}

// --- Admin: blocked Reddit posts ---

/**
 * Permanently block a Reddit post from appearing to any user.
 * Idempotent (ON CONFLICT DO NOTHING).
 */
export async function blockRedditPost(appId, redditPostId, blockedBy) {
  const db = getPool();
  await db.query(
    `INSERT INTO blocked_reddit_posts (app_id, reddit_post_id, blocked_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (app_id, reddit_post_id) DO NOTHING`,
    [appId, redditPostId, blockedBy]
  );
}

/**
 * Returns a Set of blocked Reddit post IDs for the given app.
 */
export async function getBlockedRedditPostIds(appId) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT reddit_post_id FROM blocked_reddit_posts WHERE app_id = $1`,
    [appId]
  );
  return new Set(rows.map(r => r.reddit_post_id));
}

// --- Sync state (for SRD hash, etc.) ---

export async function getSyncState(appId, key) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT value FROM sync_state WHERE app_id = $1 AND key = $2`,
    [appId, key]
  );
  return rows[0]?.value ?? null;
}

export async function setSyncState(appId, key, value) {
  const db = getPool();
  await db.query(
    `INSERT INTO sync_state (app_id, key, value, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (app_id, key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [appId, key, value]
  );
}

// --- External item cache (SRD, FCG, HoD) ---

export async function upsertExternalCache(appId, source, collection, externalId, data, rawHash = '') {
  const db = getPool();
  await db.query(
    `INSERT INTO external_item_cache (app_id, source, collection, external_id, raw_hash, data, fetched_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (app_id, source, collection, external_id)
     DO UPDATE SET raw_hash = EXCLUDED.raw_hash, data = EXCLUDED.data, fetched_at = now()`,
    [appId, source, collection, externalId, rawHash, data]
  );
}

export async function getExternalCacheByIds(appId, collection, ids) {
  if (!ids || ids.length === 0) return [];
  const db = getPool();
  const { rows } = await db.query(
    `SELECT external_id AS id, source, data,
       COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = e.app_id AND ip.collection = e.collection AND ip.item_id = e.external_id AND ip.action = 'clone'), 0) AS clone_count,
       COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = e.app_id AND ip.collection = e.collection AND ip.item_id = e.external_id AND ip.action = 'play'), 0) AS play_count
     FROM external_item_cache e
     WHERE e.app_id = $1 AND e.collection = $2 AND e.external_id = ANY($3)`,
    [appId, collection, ids]
  );
  return rows.map(r => ({
    id: r.id,
    ...r.data,
    clone_count: r.clone_count,
    play_count: r.play_count,
    _source: r.source,
  }));
}

export async function deleteExternalCacheBySource(appId, source, collection) {
  const db = getPool();
  await db.query(
    `DELETE FROM external_item_cache WHERE app_id = $1 AND source = $2 AND collection = $3`,
    [appId, source, collection]
  );
}

/**
 * Return Set of external_ids we have in cache for a given source.
 * Used by HoD sync to skip items we already have (incremental mode).
 */
export async function getCachedExternalIds(appId, source) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT external_id FROM external_item_cache
     WHERE app_id = $1 AND source = $2`,
    [appId, source]
  );
  return new Set(rows.map(r => r.external_id));
}

// --- Unified query (items + external_item_cache) ---

const SORT_OPTIONS = {
  popularity: { order: '(cc + pc) DESC, data->>\'name\' ASC' },
  name: { order: 'data->>\'name\' ASC' },
  type: { order: 'type_val ASC, data->>\'name\' ASC' },
  source: { order: '_source ASC, data->>\'name\' ASC' },
  tier: { order: 'tier_val ASC, data->>\'name\' ASC' },
};

/**
 * Unified paginated query combining items (own + public) and external_item_cache (srd, hod).
 * Single OFFSET/LIMIT, no source ordering.
 *
 * @param {object} opts
 * @param {boolean} opts.includeMine
 * @param {boolean} opts.includePublic
 * @param {boolean} opts.includeSrd
 * @param {boolean} opts.includeHod
 * @param {string} opts.search
 * @param {number|null} opts.tierMax
 * @param {boolean} [opts.tierMaxExclusive] When true with tierMax, filter to tiers strictly below tierMax (adversary upscaled-only).
 * @param {number[]} opts.tiers
 * @param {string} opts.typeField - JSON key for primary type/role filter (e.g. 'role', 'domain')
 * @param {string} opts.tierExprSql - SQL fragment for numeric tier/level column (default: tier from JSON)
 * @param {string} opts.extraTypeField - optional second JSON key (e.g. physical_or_magical on weapons)
 * @param {string[]} opts.typeValues
 * @param {string[]} opts.extraTypeValues - filter on extraTypeField
 * @param {string} opts.sort - 'popularity' | 'name' | 'type' | 'source' | 'tier'
 * @param {string} opts.sortDir - 'asc' | 'desc'
 * @param {boolean} opts.countOnly - when true, run COUNT only (no row fetch)
 */
export async function getUnifiedItems(appId, userId, collection, {
  includeMine = true,
  includePublic = false,
  includeSrd = false,
  includeHod = false,
  search = '',
  tierMax = null,
  tierMaxExclusive = false,
  tiers = [],
  typeField = null,
  typeValues = [],
  extraTypeField = null,
  extraTypeValues = [],
  tierExprSql = null,
  sort = 'popularity',
  sortDir = 'asc',
  offset = 0,
  limit = 20,
  countOnly = false,
} = {}) {
  if (DIRECT_SRD_COLLECTIONS.has(collection)) {
    if (!includeSrd) return { items: [], totalCount: 0 };

    const { items: rawItems, totalCount } = await searchSrdCollection(collection, {
      search,
      tier: null,
      tierMax,
      tiers,
      type: typeValues[0] || null,
      types: typeValues,
      limit: 5000,
      offset: 0,
    });

    const items = (rawItems || [])
      .map((item) => ({
        ...item,
        clone_count: 0,
        play_count: 0,
        is_public: false,
        _source: 'srd',
      }));

    const ordered = [...items];
    if (sort === 'name' || sort === 'popularity' || sort === 'source' || sort === 'tier' || sort === 'type') {
      ordered.sort((a, b) => compareLibraryAllItems(
        { ...a, _collection: collection },
        { ...b, _collection: collection },
        sort
      ));
    }

    return {
      items: countOnly ? [] : ordered.slice(offset, offset + limit),
      totalCount,
    };
  }

  const db = getPool();
  const parts = [];
  const params = [];
  let p = 1;

  const sortOpt = SORT_OPTIONS[sort] || SORT_OPTIONS.popularity;
  const typeExpr = typeField ? `data->>'${typeField.replace(/[^a-z0-9_]/gi, '')}'` : `''`;
  const tierExpr = tierExprSql || `COALESCE((data->>'tier')::int, 1)`;
  const extraTypeExpr = extraTypeField ? `data->>'${extraTypeField.replace(/[^a-z0-9_]/gi, '')}'` : `''`;

  if (includeMine || includePublic) {
    const srcClauses = [];
    if (includeMine) {
      srcClauses.push(`i.user_id = $${p}`);
      params.push(userId);
      p++;
    }
    if (includePublic) {
      srcClauses.push(`(i.is_public = true AND i.user_id != $${p} AND i.user_id != '${MIRROR_USER_ID}')`);
      params.push(userId);
      p++;
    }
    const srcSQL = srcClauses.join(' OR ');
    const uidParam = includeMine ? 1 : 2;
    parts.push(`(
      SELECT i.id, i.data, i.user_id, i.is_public,
        COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'clone'), 0) AS cc,
        COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'play'), 0) AS pc,
        CASE WHEN i.user_id = $${uidParam} THEN 'own' ELSE 'public' END AS _source,
        ${typeExpr} AS type_val,
        (${tierExpr})::int AS tier_val,
        ${extraTypeExpr} AS extra_type_val
      FROM items i
      WHERE i.app_id = $${p} AND i.collection = $${p + 1} AND (${srcSQL})
    )`);
    params.push(appId, collection);
    p += 2;
  }

  const extSources = [];
  if (includeSrd) extSources.push('srd');
  if (includeHod) extSources.push('hod');

  if (extSources.length > 0) {
    parts.push(`(
      SELECT e.external_id AS id, e.data, NULL::text AS user_id, false AS is_public,
        COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = e.app_id AND ip.collection = e.collection AND ip.item_id = e.external_id AND ip.action = 'clone'), 0) AS cc,
        COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = e.app_id AND ip.collection = e.collection AND ip.item_id = e.external_id AND ip.action = 'play'), 0) AS pc,
        e.source AS _source,
        ${typeExpr} AS type_val,
        (${tierExpr})::int AS tier_val,
        ${extraTypeExpr} AS extra_type_val
      FROM external_item_cache e
      WHERE e.app_id = $${p} AND e.collection = $${p + 1} AND e.source = ANY($${p + 2}::text[])
    )`);
    params.push(appId, collection, extSources);
    p += 3;
  }

  if (parts.length === 0) {
    return { items: [], totalCount: 0 };
  }

  const unionSQL = parts.join(' UNION ALL ');
  const filterClauses = [];
  if (search) {
    filterClauses.push(`u.data->>'name' ILIKE '%' || $${p} || '%'`);
    params.push(search);
    p++;
  }
  if (tierMax != null) {
    filterClauses.push(tierMaxExclusive ? `u.tier_val < $${p}` : `u.tier_val <= $${p}`);
    params.push(Number(tierMax));
    p++;
  } else if (tiers.length > 0) {
    filterClauses.push(`u.tier_val = ANY($${p}::int[])`);
    params.push(tiers.map(t => Number(t)));
    p++;
  }
  if (typeField && typeValues.length > 0) {
    filterClauses.push(`LOWER(u.type_val) = ANY($${p}::text[])`);
    params.push(typeValues.map(v => String(v).toLowerCase()));
    p++;
  }
  if (extraTypeField && extraTypeValues.length > 0) {
    filterClauses.push(`LOWER(u.extra_type_val) = ANY($${p}::text[])`);
    params.push(extraTypeValues.map(v => String(v).toLowerCase()));
    p++;
  }
  const filterSQL = filterClauses.length > 0 ? 'AND ' + filterClauses.join(' AND ') : '';

  const countParams = [...params];
  const countSQL = `SELECT COUNT(*) AS cnt FROM (${unionSQL}) u WHERE 1=1 ${filterSQL}`;
  const { rows: countRows } = await db.query(countSQL, countParams);
  const totalCount = parseInt(countRows[0]?.cnt ?? 0, 10);

  if (countOnly) {
    return { items: [], totalCount };
  }

  const orderClause = sortOpt.order;
  const dataParams = [...params, offset, limit];
  const dataSQL = `SELECT u.id, u.data, u.user_id, u.is_public, u.cc, u.pc, u._source FROM (${unionSQL}) u WHERE 1=1 ${filterSQL} ORDER BY ${orderClause} OFFSET $${p} LIMIT $${p + 1}`;
  const { rows } = await db.query(dataSQL, dataParams);

  const items = rows.map(r => {
    const source = r._source;
    const owner = source === 'public' ? r.user_id : undefined;
    return {
      id: r.id,
      ...r.data,
      is_public: r.is_public ?? false,
      clone_count: r.cc,
      play_count: r.pc,
      _source: source,
      ...(owner ? { _owner: owner } : {}),
    };
  });

  return { items, totalCount };
}

const LIBRARY_ALL_FETCH_LIMIT = 250000;

function libraryAllTypeSortKey(item, collection) {
  switch (collection) {
    case 'adversaries':
      return String(item.role || '').toLowerCase();
    case 'environments':
      return String(item.type || '').toLowerCase();
    case 'abilities':
      return String(item.domain || '').toLowerCase();
    case 'weapons':
      return `${item.primary_or_secondary || ''}|${item.physical_or_magical || ''}`.toLowerCase();
    case 'features':
      return String(item._scope || '').toLowerCase();
    default:
      return '';
  }
}

function libraryAllTierSortVal(item, collection) {
  if (collection === 'abilities') return Number(item.level ?? 1);
  if (collection === 'features') {
    const t = item.tier;
    if (t === undefined || t === null || t === '') return 999;
    return Number(t);
  }
  return Number(item.tier ?? 1);
}

function compareLibraryAllItems(a, b, sort) {
  const nameCmp = () => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
  if (sort === 'popularity') {
    const pa = (a.clone_count || 0) + (a.play_count || 0);
    const pb = (b.clone_count || 0) + (b.play_count || 0);
    if (pb !== pa) return pb - pa;
    return nameCmp();
  }
  if (sort === 'name') {
    return nameCmp();
  }
  if (sort === 'source') {
    const sc = String(a._source || '').localeCompare(String(b._source || ''));
    if (sc !== 0) return sc;
    return nameCmp();
  }
  if (sort === 'tier') {
    const ta = libraryAllTierSortVal(a, a._collection);
    const tb = libraryAllTierSortVal(b, b._collection);
    if (ta !== tb) return ta - tb;
    return nameCmp();
  }
  if (sort === 'type') {
    const ta = libraryAllTypeSortKey(a, a._collection);
    const tb = libraryAllTypeSortKey(b, b._collection);
    const c = ta.localeCompare(tb);
    if (c !== 0) return c;
    return nameCmp();
  }
  return nameCmp();
}

/**
 * Shared per-collection branch fetch for Library "All" (merge) vs count-only.
 * @param {boolean} countOnly - pass through to getUnifiedItems (no row fetch when true)
 */
async function fetchFeaturesLibraryAllBranch(opts, countOnly) {
  const { search = '', featScope = [], tiers = [], includeSrd = false } = opts;
  const tierNums = Array.isArray(tiers)
    ? tiers.map(t => Number(t)).filter(n => !isNaN(n) && n >= 1 && n <= 12)
    : [];
  if (!includeSrd) {
    return { collection: 'features', items: [], totalCount: 0 };
  }
  if (countOnly) {
    const n = countFeatureCatalog({ search, featScope, tiers: tierNums });
    return { collection: 'features', items: [], totalCount: n };
  }
  const { items, totalCount } = filterFeatureCatalog({
    search,
    featScope,
    tiers: tierNums,
    sort: 'name',
    offset: 0,
    limit: LIBRARY_ALL_FETCH_LIMIT,
  });
  return { collection: 'features', items, totalCount };
}

/**
 * Own + public `scenes` rows for Library "All" (no SRD/HoD cache — scenes are DB-only).
 * @param {boolean} countOnly - pass through to getUnifiedItems (no row fetch when true)
 */
async function fetchScenesLibraryAllBranch(appId, userId, opts, countOnly) {
  const {
    includeMine = true,
    includePublic = false,
    search = '',
    tiers = [],
    levels = [],
    includeScaledUp = false,
  } = opts;

  const tierNums = Array.isArray(tiers)
    ? tiers.map(t => Number(t)).filter(n => !isNaN(n) && n >= 1 && n <= 12)
    : [];
  const levelNums = Array.isArray(levels)
    ? levels.map(t => Number(t)).filter(n => !isNaN(n) && n >= 1 && n <= 12)
    : [];

  const cfg = unifiedListConfig('scenes');
  const { tiersParam, tierMax, tierMaxExclusive } = resolveLibraryAllBranchTiers('scenes', {
    tierNums,
    levelNums,
    includeScaledUp,
  });

  const result = await getUnifiedItems(appId, userId, 'scenes', {
    includeMine,
    includePublic,
    search,
    tierMax,
    tierMaxExclusive,
    tiers: tiersParam,
    tierExprSql: cfg.tierExprSql,
    sort: 'popularity',
    offset: 0,
    limit: countOnly ? 0 : LIBRARY_ALL_FETCH_LIMIT,
    countOnly,
  });

  return { collection: 'scenes', items: result.items, totalCount: result.totalCount };
}

async function runLibraryAllBranches(appId, userId, opts, countOnly) {
  const {
    includeMine = true,
    includePublic = false,
    includeSrd = false,
    includeHod = false,
    search = '',
    tiers = [],
    levels = [],
    advRole = [],
    envType = [],
    ablDomain = [],
    wpnSlot = [],
    wpnPhyMag = [],
    includeScaledUp = false,
    featScope = [],
  } = opts;

  const tierNums = tiers.map(t => Number(t)).filter(n => !isNaN(n) && n >= 1 && n <= 12);
  const levelNums = levels.map(t => Number(t)).filter(n => !isNaN(n) && n >= 1 && n <= 12);

  const srdCollections = SRD_COLLECTION_NAMES.filter(c => shouldIncludeLibraryAllBranch(c, opts));

  const srdBranches = await Promise.all(
    srdCollections.map(async (collection) => {
      const cfg = unifiedListConfig(collection);
      const { tiersParam, tierMax, tierMaxExclusive } = resolveLibraryAllBranchTiers(collection, {
        tierNums,
        levelNums,
        includeScaledUp,
      });
      const { typeValues, extraTypeValues } = resolveLibraryAllBranchTypes(collection, {
        advRole,
        envType,
        ablDomain,
        wpnSlot,
        wpnPhyMag,
      });

      const result = await getUnifiedItems(appId, userId, collection, {
        includeMine,
        includePublic,
        includeSrd,
        includeHod,
        search,
        tierMax,
        tierMaxExclusive,
        tiers: tiersParam,
        typeField: cfg.typeField,
        typeValues,
        extraTypeField: cfg.extraTypeField,
        extraTypeValues,
        tierExprSql: cfg.tierExprSql,
        sort: 'popularity',
        offset: 0,
        limit: countOnly ? 0 : LIBRARY_ALL_FETCH_LIMIT,
        countOnly,
      });

      return { collection, items: result.items, totalCount: result.totalCount };
    })
  );

  const featBranch = shouldIncludeLibraryAllBranch('features', opts)
    ? await fetchFeaturesLibraryAllBranch(
      { search, featScope, tiers: tierNums, includeSrd },
      countOnly
    )
    : { collection: 'features', items: [], totalCount: 0 };
  const scenesBranch = shouldIncludeLibraryAllBranch('scenes', opts)
    ? await fetchScenesLibraryAllBranch(appId, userId, opts, countOnly)
    : { collection: 'scenes', items: [], totalCount: 0 };
  return [...srdBranches, featBranch, scenesBranch];
}

/**
 * Per-collection match counts for Library filters (COUNT queries only; no row fetch).
 */
export async function getUnifiedLibraryAllBranchCounts(appId, userId, opts = {}) {
  const branches = await runLibraryAllBranches(appId, userId, opts, true);
  const countsByCollection = {};
  let totalCount = 0;
  for (const b of branches) {
    countsByCollection[b.collection] = b.totalCount;
    totalCount += b.totalCount;
  }
  return { countsByCollection, totalCount };
}

/**
 * Merged library browse across all SRD unified collections. Each row includes `_collection`.
 * Filters are applied per collection (see server route); results are merged and sorted in memory.
 */
export async function getUnifiedLibraryAll(appId, userId, opts = {}) {
  const {
    sort = 'popularity',
    offset = 0,
    limit = 20,
  } = opts;

  const branches = await runLibraryAllBranches(appId, userId, opts, false);

  const countsByCollection = {};
  let totalCount = 0;
  const merged = [];
  for (const b of branches) {
    countsByCollection[b.collection] = b.totalCount;
    totalCount += b.totalCount;
    for (const item of b.items) {
      merged.push({ ...item, _collection: b.collection });
    }
  }

  merged.sort((a, b) => {
    const c = compareLibraryAllItems(a, b, sort);
    if (c !== 0) return c;
    const d = String(a._collection || '').localeCompare(String(b._collection || ''));
    if (d !== 0) return d;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  const slice = merged.slice(offset, offset + limit);
  const items = slice.map(item => ({
    ...item,
    popularity: (item.clone_count || 0) + (item.play_count || 0),
  }));

  return { items, totalCount, nextOffset: offset + items.length, countsByCollection };
}

/**
 * Look up a single table_state row by globally unique tableId (primary = gmUid, secondary = uuid).
 * Returns { userId, data } or null.
 */
export async function getTableStateById(appId, tableId) {
  if (!tableId) return null;
  const db = getPool();
  const { rows } = await db.query(
    `SELECT user_id, data FROM items
     WHERE app_id = $1 AND collection = 'table_state' AND id = $2`,
    [appId, tableId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return { userId: r.user_id, data: r.data };
}

/**
 * List all table_state rows for a user (GM's owned tables).
 * Returns [{ id, data }] for use by GET /api/my-tables.
 */
export async function listTableStates(appId, userId) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT id, data FROM items
     WHERE app_id = $1 AND user_id = $2 AND collection = 'table_state'
     ORDER BY id ASC`,
    [appId, userId]
  );
  return rows.map(r => ({ id: r.id, data: r.data }));
}

/**
 * Find all table_state records whose playerEmails array contains the given email.
 * Used by GET /api/my-rooms to let players discover which tables have invited them.
 * Returns [{ tableId, userId, data }] where tableId is the row's id, userId is the GM's Firebase UID.
 */
export async function getTableStatesByPlayerEmail(appId, email) {
  const db = getPool();
  // Use the ? (key exists in array) JSONB operator to check membership.
  // Note: in node-postgres, ? is not a placeholder — $1/$2 are used for that.
  const { rows } = await db.query(
    `SELECT id, user_id, data FROM items
     WHERE app_id = $1 AND collection = 'table_state'
     AND data->'playerEmails' ? $2`,
    [appId, email]
  );
  return rows.map(r => ({ tableId: r.id, userId: r.user_id, data: r.data }));
}

/**
 * Summarize invited players on a table_state `data` object for roster display.
 * Returns `{ count, players: [{ email, name }] }` with `name` from a matching
 * assigned character's `playerName`, falling back to the email.
 */
export function summarizeTablePlayerRoster(data) {
  const emails = data?.playerEmails || [];
  const elements = data?.elements || [];
  const players = emails.map(email => {
    const match = elements.find(el => el.assignedPlayerEmail === email && el.playerName);
    return { email, name: match?.playerName || email };
  });
  return { count: players.length, players };
}

export async function getWhiteboardSnapshot(appId, gmUid) {
  const db = getPool();
  const { rows } = await db.query(
    'SELECT snapshot FROM whiteboard_snapshots WHERE app_id = $1 AND gm_uid = $2',
    [appId, gmUid]
  );
  return rows[0]?.snapshot ?? null;
}

export async function saveWhiteboardSnapshot(appId, gmUid, snapshot) {
  const db = getPool();
  await db.query(
    `INSERT INTO whiteboard_snapshots (app_id, gm_uid, snapshot, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (app_id, gm_uid)
     DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()`,
    [appId, gmUid, JSON.stringify(snapshot)]
  );
}

// CHARACTER_PERSIST_KEYS mirrors the set in table-ops.js. Kept here to avoid a circular import.
// Any _ prefixed key on a character element is also preserved automatically
// (ancestry/class feature state uses _ prefix by convention, e.g. _fearlessToggle).
// Keep in sync with CHARACTER_RUNTIME_KEYS in src/client/lib/table-ops.js
const CHARACTER_RUNTIME_KEYS_DB = new Set([
  'instanceId', 'elementType',
  'currentHp', 'currentStress', 'hope', 'currentArmor', 'conditions',
  'tokenX', 'tokenY',
  'altitude',
  'mapId',
  'assignedPlayerEmail', 'assignedPlayerUid', 'playerName',
  'reinforcedActive', 'selectedExperienceIndex',
  'featureUsage', 'activeModifiers', 'focusTargetId', 'focusTargetInstanceId',   'rangerFocusOnNextAttack',
  'companion', // Beastbound: { name, species, evasion, maxStress, currentStress }; table stress preserved
  'activeBeastform', 'selectedBeastformAdvantage',
  'faerieWingsFlying',
  'retractedActive',
  'resistance',
  'disadvantageSources',
  'moveDisabledSources',
  'lockedOnTargetInstanceId',
  'featureState', // V2 per-character feature bags (see mergeDeclarativeFeatureState)
  'featureStateDeclared', // keys written via table.feature.set / table.source.set (manual)
  'prayerDice', // Seraph: { pool: number[] } — keep in sync with CHARACTER_RUNTIME_KEYS in table-ops.js
  'sheetDisplayNames', // optional { weapons, features, abilities } display overrides (Game Table)
  'v2PendingMove',
  'v2MoveLockRollDbId',
  'v2MoveLockSource',
]);
const CHARACTER_PERSIST_KEYS_DB = new Set([...CHARACTER_RUNTIME_KEYS_DB, 'id', 'name']);

/**
 * In-memory cache of resolved `characters` library rows, keyed by `${appId}:${id}`.
 * Table-state resolution (`resolveCharacterElements`) runs on every `table_state` op —
 * including adversary/map/countdown-only ops that never touch character data — so caching
 * the library row here avoids a DB round trip (`getItemsByIds`) on every one of those.
 * Invalidated precisely on write (`upsertItem`/`deleteItem` for collection `'characters'`),
 * so it can never serve stale data after a character save, regardless of which table(s)
 * reference that character or what op triggered the resolve.
 */
const characterLibraryCache = new Map();

function characterCacheKey(appId, id) {
  return `${appId}:${id}`;
}

/** Drop a single character's cached library row (called on save/delete of that character). */
export function invalidateCharacterLibraryCache(appId, id) {
  characterLibraryCache.delete(characterCacheKey(appId, id));
}

/** Test-only: clear the entire cache. */
export function clearCharacterLibraryCacheForTests() {
  characterLibraryCache.clear();
}

/**
 * Fetch character library rows by id for table-state resolution, deduplicated to ONE row per id.
 *
 * The `items` primary key is (app_id, user_id, collection, id), so the SAME character id can
 * exist under multiple users — e.g. a GM and a player who each synced the same Daggerstack
 * character into their own libraries. Table elements store only the character id, so resolution
 * must pick one row deterministically: the most recently updated row wins (last-writer-wins —
 * whichever copy was edited last, GM's or player's, is what the table shows). The previous
 * getItemsByIds-based fetch returned every duplicate and populated the cache "last row wins"
 * in arbitrary heap order, which in production let a player's stale, imageless copy shadow the
 * GM's freshly edited row on every server-side re-resolve (portraits vanished on the next
 * table_state push after any op, e.g. a map pan).
 */
async function fetchCharacterLibraryRowsByIds(appId, ids) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT i.id, i.user_id, i.data, i.is_public, i.updated_at
     FROM items i
     WHERE i.app_id = $1 AND i.collection = 'characters' AND i.id = ANY($2)`,
    [appId, ids]
  );
  const newestById = new Map();
  for (const r of rows) {
    const prev = newestById.get(r.id);
    if (!prev) { newestById.set(r.id, r); continue; }
    const tPrev = new Date(prev.updated_at ?? 0).getTime();
    const tCur = new Date(r.updated_at ?? 0).getTime();
    // Newest updated_at wins; tie-break on user_id so the pick is stable across resolves.
    if (tCur > tPrev || (tCur === tPrev && String(r.user_id) < String(prev.user_id))) {
      newestById.set(r.id, r);
    }
  }
  return [...newestById.values()].map(r => ({
    id: r.id,
    ...r.data,
    is_public: r.is_public,
    _source: r.is_public ? 'public' : 'own',
  }));
}

/**
 * Resolve character elements against the live character library.
 * Non-character elements are returned unchanged. Characters not found
 * fall back to their stored data.
 */
export async function resolveCharacterElements(appId, elements) {
  if (!elements?.length) return elements;
  const charIds = [...new Set(
    elements.filter(el => el.elementType === 'character' && el.id).map(el => el.id)
  )];
  if (!charIds.length) return elements;
  const missingIds = charIds.filter(id => !characterLibraryCache.has(characterCacheKey(appId, id)));
  if (missingIds.length) {
    const fetched = await fetchCharacterLibraryRowsByIds(appId, missingIds);
    for (const row of fetched) {
      characterLibraryCache.set(characterCacheKey(appId, row.id), row);
    }
  }
  const libMap = new Map(
    charIds
      .map(id => [id, characterLibraryCache.get(characterCacheKey(appId, id))])
      .filter(([, row]) => row !== undefined)
  );
  return elements.map(el => {
    if (el.elementType !== 'character' || !el.id) return el;
    const lib = libMap.get(el.id);
    if (!lib) return el;
    const runtime = {};
    CHARACTER_RUNTIME_KEYS_DB.forEach(k => { if (k in el) runtime[k] = el[k]; });
    // Auto-preserve any _ prefixed keys (ancestry/class feature toggle state).
    Object.keys(el).forEach(k => { if (k.startsWith('_') && k in el) runtime[k] = el[k]; });
    const merged = { ...lib, ...runtime, elementType: 'character' };
    // companion: take fresh library fields (name, species, evasion, experiences, tokenSize*, etc.)
    // but preserve only currentStress from the table's live snapshot, matching the client-side
    // character-library-update logic in table-ops.js.
    if (lib.companion || el.companion) {
      merged.companion = { ...(lib.companion || {}), currentStress: el.companion?.currentStress };
    }
    return normalizePersistedCharacterElement(merged);
  });
}

/**
 * Strip character elements to only persisted keys before writing to the DB.
 */
export function stripCharacterElementsForDb(elements) {
  if (!elements?.length) return elements;
  return elements.map(el => {
    if (el.elementType !== 'character') return el;
    const stripped = {};
    for (const k of Object.keys(el)) {
      if (CHARACTER_PERSIST_KEYS_DB.has(k) || k.startsWith('_')) stripped[k] = el[k];
    }
    return stripped;
  });
}

const SESSION_IDLE_MS = 60 * 60 * 1000;

let onTableStateNotify = () => {};

/** Server startup: `setTableStateNotifyHook((id) => subscriptionManager.notifyChange('table_state', id))` */
export function setTableStateNotifyHook(fn) {
  onTableStateNotify = typeof fn === 'function' ? fn : () => {};
}

function tableStateBlobForSave(stateData) {
  return {
    ...stateData,
    elements: stripCharacterElementsForDb(stateData.elements || []),
  };
}

/**
 * Fetch and resolve table state by globally unique tableId.
 * Used by the 'table_state' subscription channel.
 * Seeds `top.lastPlayActivityAt`, applies 1h idle `top.sessionPaused`, and notifies subscribers when the blob changes.
 */
export async function getResolvedTableState(appId, tableId) {
  const row = await getTableStateById(appId, tableId);
  if (!row) return null;
  let stateData = row.data || {};
  const userId = row.userId;
  let didPersist = false;

  const top0 = stateData.top;
  if (top0 && typeof top0 === 'object' && top0.sessionStarted && !top0.sessionPaused && top0.lastPlayActivityAt == null) {
    const seeded = {
      ...stateData,
      top: { ...top0, lastPlayActivityAt: Date.now() },
    };
    await upsertItem(appId, userId, 'table_state', tableId, tableStateBlobForSave(seeded), false);
    stateData = seeded;
    didPersist = true;
  }

  const top = stateData.top;
  if (top && typeof top === 'object' && top.sessionStarted && !top.sessionPaused && typeof top.lastPlayActivityAt === 'number' && !Number.isNaN(top.lastPlayActivityAt)) {
    if (Date.now() - top.lastPlayActivityAt > SESSION_IDLE_MS) {
      const paused = {
        ...stateData,
        top: { ...top, sessionPaused: true },
      };
      await upsertItem(appId, userId, 'table_state', tableId, tableStateBlobForSave(paused), false);
      stateData = paused;
      didPersist = true;
    }
  }

  if (didPersist) {
    onTableStateNotify(tableId);
  }

  const elements = stateData.elements || [];
  const resolved = await resolveCharacterElements(appId, elements);
  const inviteLink = await getActiveTableInviteLink(appId, tableId);
  return attachDerivedMapConfig({ ...stateData, elements: resolved, inviteLink });
}

export async function appendDiceRoll(appId, gmUid, rollData, opts = {}) {
  const status = opts.status ?? 'pending';
  const db = getPool();
  const { rows } = await db.query(
    'INSERT INTO dice_rolls (app_id, gm_uid, data, status) VALUES ($1, $2, $3, $4) RETURNING id',
    [appId, gmUid, JSON.stringify(rollData), status]
  );
  return rows[0].id;
}

/** Set the status ('acknowledged' | 'cancelled') for a banner queue entry. */
export async function setBannerStatus(id, status) {
  const db = getPool();
  await db.query('UPDATE dice_rolls SET status = $1 WHERE id = $2', [status, id]);
}

/** @deprecated Use setBannerStatus instead. Kept for any external callers during migration. */
export async function ackDiceRoll(id) {
  return setBannerStatus(id, 'acknowledged');
}

/** Returns last N rolls (all statuses) oldest-first — used for the Action Log history strip. */
export async function getRecentDiceRolls(appId, gmUid, limit = 50) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT id, data, acked, status FROM dice_rolls
     WHERE app_id = $1 AND gm_uid = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [appId, gmUid, limit]
  );
  // Reverse so oldest-first order matches client expectations; merge id, acked, status into data
  return rows.reverse().map(r => ({ ...r.data, _rollDbId: r.id, _acked: r.acked, _status: r.status }));
}

/** Returns only pending banners (status = 'pending') oldest-first — used for the initial banner queue on SSE connect. */
export async function getPendingBanners(appId, gmUid) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT id, data, status FROM dice_rolls
     WHERE app_id = $1 AND gm_uid = $2 AND status = 'pending'
     ORDER BY created_at ASC`,
    [appId, gmUid]
  );
  return rows.map(r => ({ ...r.data, _rollDbId: r.id, _status: r.status }));
}

/** Returns a single dice roll by id and room (for player self-cancel verification). */
export async function getDiceRollById(appId, gmUid, id) {
  const db = getPool();
  const { rows } = await db.query(
    'SELECT id, data, status FROM dice_rolls WHERE app_id = $1 AND gm_uid = $2 AND id = $3',
    [appId, gmUid, id]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, data: r.data, status: r.status };
}

/** Merge a patch into a pending dice roll's data (e.g. _felineRerollRequestedBy). */
export async function updateDiceRollData(appId, gmUid, id, dataPatch) {
  const db = getPool();
  const { rows } = await db.query(
    'SELECT data FROM dice_rolls WHERE app_id = $1 AND gm_uid = $2 AND id = $3 AND status = $4',
    [appId, gmUid, id, 'pending']
  );
  if (rows.length === 0) return false;
  const merged = { ...rows[0].data, ...dataPatch };
  await db.query(
    'UPDATE dice_rolls SET data = $1 WHERE id = $2 AND app_id = $3 AND gm_uid = $4',
    [JSON.stringify(merged), id, appId, gmUid]
  );
  return true;
}

/** Per-user JSON preferences (e.g. hide AI UI, library card sizes). */
export async function getUserPreferences(appId, userId) {
  if (!process.env.DATABASE_URL) {
    return normalizeUserPreferences({});
  }
  const db = getPool();
  const { rows } = await db.query(
    'SELECT data FROM user_preferences WHERE app_id = $1 AND user_id = $2',
    [appId, userId]
  );
  if (!rows.length) return normalizeUserPreferences({});
  return normalizeUserPreferences(rows[0].data || {});
}

/**
 * Merge `patch` into stored preferences (deep-merges `libraryCardDimensions` per tab).
 * Writes the full normalized document so nested maps are not wiped by shallow JSONB `||`.
 */
export async function upsertUserPreferences(appId, userId, patch) {
  if (!process.env.DATABASE_URL) return normalizeUserPreferences({});
  const current = await getUserPreferences(appId, userId);
  const merged = mergeUserPreferencesData(current, patch);
  const db = getPool();
  await db.query(
    `INSERT INTO user_preferences (app_id, user_id, data, updated_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (app_id, user_id) DO UPDATE SET
       data = EXCLUDED.data,
       updated_at = now()`,
    [appId, userId, JSON.stringify(merged)]
  );
  return merged;
}

/** @param {{ appId: string, userId?: string|null, builder: string, provider: 'openai'|'xai', model?: string|null, promptTokens?: number|null, completionTokens?: number|null, cachedPromptTokens?: number|null, totalTokens?: number|null, latencyMs?: number|null, ok: boolean, errorCode?: string|null, requestId?: string|null }} row */
export async function insertAiUsageEvent(row) {
  if (!process.env.DATABASE_URL) return;
  const db = getPool();
  await db.query(
    `INSERT INTO ai_usage_events (
       app_id, user_id, builder, provider, model,
       prompt_tokens, completion_tokens, cached_prompt_tokens, total_tokens,
       latency_ms, ok, error_code, request_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      row.appId,
      row.userId ?? null,
      row.builder,
      row.provider,
      row.model ?? null,
      row.promptTokens ?? null,
      row.completionTokens ?? null,
      row.cachedPromptTokens ?? null,
      row.totalTokens ?? null,
      row.latencyMs ?? null,
      row.ok,
      row.errorCode ?? null,
      row.requestId ?? null,
    ],
  );
}

// ── Billing helpers ────────────────────────────────────────────────────────────

/**
 * Get a billing_customers row for a user. Returns null if not found.
 * @param {string} appId
 * @param {string} userId
 */
export async function getBillingCustomer(appId, userId) {
  const db = getPool();
  const result = await db.query(
    'SELECT * FROM billing_customers WHERE app_id = $1 AND user_id = $2',
    [appId, userId],
  );
  return result.rows[0] ?? null;
}

/**
 * Atomically claim the one-lifetime free trial for a user on a specific table.
 * TOCTOU-safe: uses UPDATE ... WHERE free_trial_started_at IS NULL (row-level lock serializes
 * concurrent claims). The INSERT ensures the row exists first.
 *
 * Returns true if the trial was newly claimed by this call, false if already claimed.
 * @param {string} appId
 * @param {string} tableId - the table where the trial is being activated
 * @param {string} userId  - the table owner's user ID
 * @returns {Promise<boolean>}
 */
export async function stampFreeTrialStart(appId, tableId, userId) {
  const db = getPool();
  // Ensure the billing_customers row exists (idempotent).
  await db.query(
    `INSERT INTO billing_customers (app_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [appId, userId],
  );
  // Atomic claim: only succeeds when free_trial_started_at IS NULL.
  // Concurrent callers serialize on the row-level lock; only one returns a row.
  const result = await db.query(
    `UPDATE billing_customers
        SET free_trial_started_at = now(),
            free_trial_table_id   = $3,
            updated_at            = now()
      WHERE app_id = $1
        AND user_id = $2
        AND free_trial_started_at IS NULL
      RETURNING *`,
    [appId, userId, tableId],
  );
  return result.rows.length > 0;
}

/**
 * Check whether a table is currently "live" (has active entitlement to host sessions).
 * Returns an object with { live, reason, ... }.
 *
 * A table is live when:
 *   - It has an active Campaign Pass (paid_through_at > now()), OR
 *   - The table owner has a free trial active for this exact table (within 1 month of start).
 *
 * This function only reads; it never stamps the trial. Call stampFreeTrialStart first when needed.
 *
 * @param {string} appId
 * @param {string} tableId
 * @param {string} ownerUserId - table owner's Firebase uid
 * @returns {Promise<{ live: boolean, reason: string, trialEndsAt?: string, paidThroughAt?: string }>}
 */
export async function checkTableIsLive(appId, tableId, ownerUserId) {
  const db = getPool();
  const now = new Date();

  // 1. Check active Campaign Pass (table-scoped, not purchaser-scoped).
  const passResult = await db.query(
    'SELECT paid_through_at FROM table_campaign_passes WHERE app_id = $1 AND table_id = $2',
    [appId, tableId],
  );
  if (passResult.rows.length > 0 && passResult.rows[0].paid_through_at) {
    if (new Date(passResult.rows[0].paid_through_at) > now) {
      return { live: true, reason: 'campaign_pass', paidThroughAt: passResult.rows[0].paid_through_at };
    }
  }

  // 2. Check free trial (owner-scoped, one lifetime, table-scoped to the activation table).
  // Trial duration (exactly 1 calendar month from activation) is computed in SQL via `interval`
  // rather than JS `Date.setMonth` — JS month arithmetic silently overflows on short months
  // (e.g. Jan 31 + 1 "month" rolls into March), which would drift from calendar-month semantics.
  const billingResult = await db.query(
    `SELECT free_trial_started_at,
            free_trial_table_id,
            (free_trial_started_at + interval '1 month') AS trial_end_at,
            (now() < (free_trial_started_at + interval '1 month')) AS trial_active
       FROM billing_customers
      WHERE app_id = $1 AND user_id = $2`,
    [appId, ownerUserId],
  );

  if (!billingResult.rows.length || !billingResult.rows[0].free_trial_started_at) {
    return { live: false, reason: 'never_started' };
  }

  const { free_trial_table_id, trial_end_at, trial_active } = billingResult.rows[0];

  // Trial is only valid for the specific table where it was first activated.
  if (free_trial_table_id !== tableId) {
    return { live: false, reason: 'trial_used_on_other_table' };
  }

  const trialEndsAt = new Date(trial_end_at).toISOString();
  if (trial_active) {
    return { live: true, reason: 'free_trial', trialEndsAt };
  }

  return { live: false, reason: 'trial_expired', trialEndsAt };
}

/**
 * Get a table_campaign_passes row. Returns null if not found.
 * @param {string} appId
 * @param {string} tableId
 */
export async function getTableCampaignPass(appId, tableId) {
  const db = getPool();
  const result = await db.query(
    'SELECT * FROM table_campaign_passes WHERE app_id = $1 AND table_id = $2',
    [appId, tableId],
  );
  return result.rows[0] ?? null;
}

/**
 * Extend a table's Campaign Pass expiry.
 * Consecutive purchases stack: new expiry = max(now(), paid_through_at) + months.
 * Also accumulates lifetime_cents_total for LTV telemetry.
 * @param {string} appId
 * @param {string} tableId
 * @param {number} months  - 3, 6, or 12
 * @param {number} amountCents
 */
export async function extendTableCampaignPass(appId, tableId, months, amountCents) {
  const db = getPool();
  await db.query(
    `INSERT INTO table_campaign_passes (app_id, table_id, paid_through_at, lifetime_cents_total)
     VALUES (
       $1, $2,
       now() + ($3 || ' months')::interval,
       $4
     )
     ON CONFLICT (app_id, table_id) DO UPDATE SET
       paid_through_at      = GREATEST(now(), table_campaign_passes.paid_through_at) + ($3 || ' months')::interval,
       lifetime_cents_total = table_campaign_passes.lifetime_cents_total + EXCLUDED.lifetime_cents_total,
       updated_at           = now()`,
    [appId, tableId, String(months), amountCents],
  );
}

/**
 * Record an individual Campaign Pass purchase in the append-only history table.
 * ON CONFLICT DO NOTHING on stripe_checkout_session_id provides idempotency for webhook retries.
 *
 * Returns whether this call actually inserted a new row (true) vs. hit the unique-constraint
 * conflict because this session was already recorded (false). Callers MUST use this return
 * value to gate the entitlement side-effect (extendTableCampaignPass) — this is the single
 * source of truth for "has this specific purchase already been fulfilled", independent of
 * (and more reliable than) any event-id-based dedup upstream. Without this check, calling this
 * function twice for the same session (e.g. a racy webhook redelivery, or the reconciliation
 * cron re-scanning a session already fulfilled by the webhook) would let the caller extend the
 * pass twice for a single payment.
 * @param {string} appId
 * @param {string} tableId
 * @param {string} purchasedByUserId
 * @param {string} stripeCheckoutSessionId
 * @param {string|null} stripeEventId
 * @param {number} months
 * @param {number} amountCents
 * @returns {Promise<boolean>} true when a new purchase row was inserted; false when this session was already recorded
 */
export async function recordCampaignPassPurchase(
  appId, tableId, purchasedByUserId, stripeCheckoutSessionId, stripeEventId, months, amountCents,
) {
  const db = getPool();
  const result = await db.query(
    `INSERT INTO table_campaign_pass_purchases
       (app_id, table_id, purchased_by_user_id, stripe_checkout_session_id, stripe_event_id, months, amount_cents)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (stripe_checkout_session_id) DO NOTHING
     RETURNING id`,
    [appId, tableId, purchasedByUserId, stripeCheckoutSessionId, stripeEventId ?? null, months, amountCents],
  );
  return result.rows.length > 0;
}

/**
 * Check whether a Stripe event has already been processed (read-only inspection/telemetry).
 * NOT safe as a dedup gate on its own — a plain SELECT-then-INSERT has a TOCTOU race between two
 * concurrent callers. Use markStripeEventProcessed's return value to atomically check-and-claim.
 * @param {string} appId
 * @param {string} stripeEventId
 * @returns {Promise<boolean>}
 */
export async function hasStripeEventBeenProcessed(appId, stripeEventId) {
  const db = getPool();
  const result = await db.query(
    'SELECT 1 FROM stripe_processed_events WHERE app_id = $1 AND stripe_event_id = $2',
    [appId, stripeEventId],
  );
  return result.rows.length > 0;
}

/**
 * Atomically mark a Stripe event as processed, in a single round trip.
 * Uses INSERT ... ON CONFLICT DO NOTHING RETURNING so the "check" and the "claim" happen in
 * one statement — this is what makes the dedup race-free. A separate SELECT-then-INSERT (check
 * hasStripeEventBeenProcessed, then call this) is NOT safe: two concurrent webhook deliveries for
 * the same event could both see "not yet processed" before either inserts.
 * @param {string} appId
 * @param {string} stripeEventId
 * @param {string} eventType
 * @returns {Promise<boolean>} true when this call newly claimed the event (not a duplicate); false when it was already processed
 */
export async function markStripeEventProcessed(appId, stripeEventId, eventType) {
  const db = getPool();
  const result = await db.query(
    `INSERT INTO stripe_processed_events (app_id, stripe_event_id, event_type)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING stripe_event_id`,
    [appId, stripeEventId, eventType],
  );
  return result.rows.length > 0;
}

// ── Character table placements ─────────────────────────────────────────────────

/**
 * Record that a character was placed onto a table (telemetry only — never gates anything).
 * ON CONFLICT DO NOTHING: re-adding an already-placed character is a no-op.
 * @param {string} appId
 * @param {string} userId   - character owner's Firebase uid
 * @param {string} characterId
 * @param {string} tableId
 */
export async function recordCharacterTablePlacement(appId, userId, characterId, tableId) {
  const db = getPool();
  await db.query(
    `INSERT INTO character_table_placements (app_id, user_id, character_id, table_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [appId, userId, characterId, tableId],
  );
}

/**
 * Count distinct (character_id, table_id) placements for a user (telemetry).
 * @param {string} appId
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function countCharacterTablePlacements(appId, userId) {
  const db = getPool();
  const result = await db.query(
    `SELECT COUNT(*)::int AS cnt FROM character_table_placements WHERE app_id = $1 AND user_id = $2`,
    [appId, userId],
  );
  return result.rows[0]?.cnt ?? 0;
}

/**
 * Remove all character placements for a specific table (called when the table is deleted, T3).
 * @param {string} appId
 * @param {string} tableId
 */
export async function removeCharacterTablePlacementsForTable(appId, tableId) {
  const db = getPool();
  await db.query(
    'DELETE FROM character_table_placements WHERE app_id = $1 AND table_id = $2',
    [appId, tableId],
  );
}

// ── Table invite links ─────────────────────────────────────────────────────────

/** 20 random bytes as base64url (~27 chars). Exported for unit tests. */
export function generateTableInviteToken() {
  return randomBytes(20).toString('base64url');
}

/**
 * Revoke any active invite link for the table, then insert a new one.
 * @param {string} appId
 * @param {string} tableId
 * @param {string} createdByUid
 * @returns {Promise<{ token: string, createdAt: Date }>}
 */
export async function createTableInviteLink(appId, tableId, createdByUid) {
  const token = generateTableInviteToken();
  const db = getPool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE table_invite_links SET revoked_at = now()
        WHERE app_id = $1 AND table_id = $2 AND revoked_at IS NULL`,
      [appId, tableId],
    );
    const { rows } = await client.query(
      `INSERT INTO table_invite_links (app_id, token, table_id, created_by_uid)
       VALUES ($1, $2, $3, $4)
       RETURNING token, created_at`,
      [appId, token, tableId, createdByUid],
    );
    await client.query('COMMIT');
    const r = rows[0];
    return { token: r.token, createdAt: r.created_at };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Revoke the active invite link for a table (no-op if none).
 * @returns {Promise<boolean>} true if a row was updated
 */
export async function revokeTableInviteLink(appId, tableId) {
  const db = getPool();
  const result = await db.query(
    `UPDATE table_invite_links SET revoked_at = now()
      WHERE app_id = $1 AND table_id = $2 AND revoked_at IS NULL`,
    [appId, tableId],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * @returns {Promise<{ token: string, createdAt: Date } | null>}
 */
export async function getActiveTableInviteLink(appId, tableId) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT token, created_at FROM table_invite_links
      WHERE app_id = $1 AND table_id = $2 AND revoked_at IS NULL`,
    [appId, tableId],
  );
  const r = rows[0];
  if (!r) return null;
  return { token: r.token, createdAt: r.created_at };
}

/**
 * Validate an invite token. Does not mutate playerEmails.
 * @returns {Promise<{ tableId: string } | null>}
 */
export async function redeemTableInviteLink(appId, token) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT table_id FROM table_invite_links
      WHERE app_id = $1 AND token = $2 AND revoked_at IS NULL`,
    [appId, token],
  );
  const r = rows[0];
  if (!r) return null;
  return { tableId: r.table_id };
}

/**
 * Best-effort cleanup when a table is deleted (mirrors removeCharacterTablePlacementsForTable).
 */
export async function deleteTableInviteLinksForTable(appId, tableId) {
  const db = getPool();
  await db.query(
    'DELETE FROM table_invite_links WHERE app_id = $1 AND table_id = $2',
    [appId, tableId],
  );
}

// ── AI cost cap ────────────────────────────────────────────────────────────────

/**
 * Count successful AI calls made by a user in the current calendar month.
 * Used by checkAiCostCap to enforce per-user spending limits.
 * @param {string} appId
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function countUserAiCallsThisMonth(appId, userId) {
  const db = getPool();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const result = await db.query(
    `SELECT COUNT(*)::int AS call_count
       FROM ai_usage_events
      WHERE app_id = $1
        AND user_id = $2
        AND ok = true
        AND created_at >= $3`,
    [appId, userId, monthStart.toISOString()],
  );
  return result.rows[0]?.call_count ?? 0;
}

/**
 * @param {string} appId
 * @param {{ fromInclusive: Date, toExclusive: Date, builder?: string|null }} opts
 */
export async function queryAiUsageAggregates(appId, opts) {
  const db = getPool();
  const { fromInclusive, toExclusive, builder } = opts;

  const builderFilter = builder ? 'AND builder = $4' : '';
  const params = builder
    ? [appId, fromInclusive.toISOString(), toExclusive.toISOString(), builder]
    : [appId, fromInclusive.toISOString(), toExclusive.toISOString()];

  const totalsSql = `
    SELECT
      builder,
      provider,
      model,
      COUNT(*)::int AS calls,
      COALESCE(SUM(prompt_tokens), 0)::bigint AS prompt_tokens,
      COALESCE(SUM(completion_tokens), 0)::bigint AS completion_tokens,
      COALESCE(SUM(cached_prompt_tokens), 0)::bigint AS cached_prompt_tokens,
      COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
      COALESCE(SUM(latency_ms), 0)::bigint AS latency_ms_sum,
      COUNT(*) FILTER (WHERE ok = false)::int AS errors
    FROM ai_usage_events
    WHERE app_id = $1
      AND created_at >= $2::timestamptz
      AND created_at < $3::timestamptz
      ${builderFilter}
    GROUP BY builder, provider, model
    ORDER BY builder ASC, provider ASC, model ASC NULLS LAST
  `;

  const byDaySql = `
    SELECT
      (created_at AT TIME ZONE 'UTC')::date::text AS day,
      builder,
      provider,
      model,
      COUNT(*)::int AS calls,
      COALESCE(SUM(prompt_tokens), 0)::bigint AS prompt_tokens,
      COALESCE(SUM(completion_tokens), 0)::bigint AS completion_tokens,
      COALESCE(SUM(cached_prompt_tokens), 0)::bigint AS cached_prompt_tokens,
      COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
      COUNT(*) FILTER (WHERE ok = false)::int AS errors
    FROM ai_usage_events
    WHERE app_id = $1
      AND created_at >= $2::timestamptz
      AND created_at < $3::timestamptz
      ${builderFilter}
    GROUP BY 1, builder, provider, model
    ORDER BY 1 ASC, builder ASC, provider ASC, model ASC NULLS LAST
  `;

  const [{ rows: totals }, { rows: byDay }] = await Promise.all([
    db.query(totalsSql, params),
    db.query(byDaySql, params),
  ]);

  return { totals, byDay };
}

/** Valid `bug_reports.status` values (admin Problem reports page tabs). */
export const BUG_REPORT_STATUSES = ['triage', 'bug', 'feature', 'completed', 'shipped', 'cancelled'];

/**
 * Returns the total number of bug reports for this app (across all GMs/tables).
 * @param {string} appId
 * @param {{ status?: string }} opts — when set (one of `BUG_REPORT_STATUSES`), filters to that status only.
 */
export async function countBugReports(appId, { status } = {}) {
  const db = getPool();
  const statusClause = status ? 'AND status = $2' : '';
  const params = status ? [appId, status] : [appId];
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM bug_reports WHERE app_id = $1 ${statusClause}`,
    params
  );
  return rows[0]?.total ?? 0;
}

/**
 * Returns a page of bug reports for this app, newest-first.
 * @param {string} appId
 * @param {{ limit?: number, offset?: number, status?: string }} opts — `status` filters to one of `BUG_REPORT_STATUSES`; omit for all.
 */
export async function getBugReportsPaginated(appId, { limit = 50, offset = 0, status } = {}) {
  const db = getPool();
  const statusClause = status ? 'AND status = $4' : '';
  const params = status ? [appId, limit, offset, status] : [appId, limit, offset];
  const { rows } = await db.query(
    `SELECT id, gm_uid, table_id, payload, created_at, status, status_changed_at, status_changed_by
     FROM bug_reports
     WHERE app_id = $1 ${statusClause}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    params
  );
  return rows.map(r => ({
    id: r.id,
    gmUid: r.gm_uid,
    tableId: r.table_id,
    payload: r.payload,
    createdAt: r.created_at,
    status: r.status,
    statusChangedAt: r.status_changed_at,
    statusChangedBy: r.status_changed_by,
  }));
}

/**
 * Moves a bug report to a different status (Triage / Bug / Feature / Completed / Shipped / Cancelled) —
 * a single-click transition between any two tabs on the admin Problem reports page.
 * @param {string} appId
 * @param {number} id
 * @param {{ status: string, changedByEmail?: string }} opts
 */
export async function setBugReportStatus(appId, id, { status, changedByEmail } = {}) {
  if (!BUG_REPORT_STATUSES.includes(status)) {
    throw new Error(`Invalid bug report status: ${status}`);
  }
  const db = getPool();
  const { rows } = await db.query(
    `UPDATE bug_reports
     SET status = $3, status_changed_at = now(), status_changed_by = $4
     WHERE app_id = $1 AND id = $2
     RETURNING id, gm_uid, table_id, payload, created_at, status, status_changed_at, status_changed_by`,
    [appId, id, status, changedByEmail ?? null]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    gmUid: r.gm_uid,
    tableId: r.table_id,
    payload: r.payload,
    createdAt: r.created_at,
    status: r.status,
    statusChangedAt: r.status_changed_at,
    statusChangedBy: r.status_changed_by,
  };
}

/**
 * Updates the admin-visible notes on a bug report by merging into the payload JSONB.
 * An empty or blank notes string removes the key.
 * @param {string} appId
 * @param {number} id
 * @param {string} notes
 */
export async function updateBugReportNotes(appId, id, notes) {
  const db = getPool();
  const trimmed = typeof notes === 'string' ? notes.trim() : '';
  let query, params;
  if (trimmed === '') {
    query = `UPDATE bug_reports
     SET payload = payload - 'notes'
     WHERE app_id = $1 AND id = $2
     RETURNING id, gm_uid, table_id, payload, created_at, status, status_changed_at, status_changed_by`;
    params = [appId, id];
  } else {
    query = `UPDATE bug_reports
     SET payload = jsonb_set(payload, '{notes}', $3::jsonb)
     WHERE app_id = $1 AND id = $2
     RETURNING id, gm_uid, table_id, payload, created_at, status, status_changed_at, status_changed_by`;
    params = [appId, id, JSON.stringify(trimmed)];
  }
  const { rows } = await db.query(query, params);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    gmUid: r.gm_uid,
    tableId: r.table_id,
    payload: r.payload,
    createdAt: r.created_at,
    status: r.status,
    statusChangedAt: r.status_changed_at,
    statusChangedBy: r.status_changed_by,
  };
}
