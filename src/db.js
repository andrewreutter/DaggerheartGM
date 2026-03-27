import pg from 'pg';
import { COLLECTION_NAMES as SRD_COLLECTION_NAMES } from './srd/parser.js';
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
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

/** Stores canonical copies of external (SRD played/cloned, etc.) items for local-first search and popularity tracking. */
export const MIRROR_USER_ID = '__MIRROR__';

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

export async function getItemsByIds(appId, collection, ids) {
  if (!ids || ids.length === 0) return [];
  const db = getPool();
  const { rows } = await db.query(
    `SELECT i.id, i.user_id, i.data, i.is_public,
       COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'clone'), 0) AS clone_count,
       COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = i.app_id AND ip.collection = i.collection AND ip.item_id = i.id AND ip.action = 'play'), 0) AS play_count
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
      clone_count: r.clone_count,
      play_count: r.play_count,
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
  return rows[0].id;
}

export async function deleteItem(appId, userId, collection, id) {
  const db = getPool();
  await db.query(
    `DELETE FROM items
     WHERE app_id = $1 AND user_id = $2 AND collection = $3 AND id = $4`,
    [appId, userId, collection, id]
  );
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
  return [...srdBranches, featBranch];
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
  'mapId',
  'assignedPlayerEmail', 'assignedPlayerUid', 'playerName',
  'reinforcedActive', 'selectedExperienceIndex',
  'featureUsage', 'activeModifiers', 'focusTargetId', 'focusTargetInstanceId', 'rangerFocusOnNextAttack', 'companion',
  'activeBeastform', 'selectedBeastformAdvantage',
  'faerieWingsFlying',
  'retractedActive',
  'resistance',
  'disadvantageSources',
  'moveDisabledSources',
  'lockedOnTargetInstanceId',
  'featureState', // V2 per-character feature bags (see mergeDeclarativeFeatureState)
  'prayerDice', // Seraph: { pool: number[] } — keep in sync with CHARACTER_RUNTIME_KEYS in table-ops.js
  'v2PendingMove',
  'v2MoveLockRollDbId',
  'v2MoveLockSource',
]);
const CHARACTER_PERSIST_KEYS_DB = new Set([...CHARACTER_RUNTIME_KEYS_DB, 'id', 'name']);

/**
 * Resolve character elements against the live character library.
 * Non-character elements are returned unchanged. Characters not found
 * fall back to their stored data.
 */
export async function resolveCharacterElements(appId, elements) {
  if (!elements?.length) return elements;
  const charIds = elements
    .filter(el => el.elementType === 'character' && el.id)
    .map(el => el.id);
  if (!charIds.length) return elements;
  const charRows = await getItemsByIds(appId, 'characters', charIds);
  const libMap = new Map(charRows.map(r => [r.id, r]));
  return elements.map(el => {
    if (el.elementType !== 'character' || !el.id) return el;
    const lib = libMap.get(el.id);
    if (!lib) return el;
    const runtime = {};
    CHARACTER_RUNTIME_KEYS_DB.forEach(k => { if (k in el) runtime[k] = el[k]; });
    // Auto-preserve any _ prefixed keys (ancestry/class feature toggle state).
    Object.keys(el).forEach(k => { if (k.startsWith('_') && k in el) runtime[k] = el[k]; });
    const merged = { ...lib, ...runtime, elementType: 'character' };
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
  return attachDerivedMapConfig({ ...stateData, elements: resolved });
}

export async function appendDiceRoll(appId, gmUid, rollData) {
  const db = getPool();
  const { rows } = await db.query(
    'INSERT INTO dice_rolls (app_id, gm_uid, data) VALUES ($1, $2, $3) RETURNING id',
    [appId, gmUid, JSON.stringify(rollData)]
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
