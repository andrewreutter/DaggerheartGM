import pg from 'pg';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

/** Stores canonical copies of external (SRD played/cloned, FCG, etc.) items for local-first search and popularity tracking. */
export const MIRROR_USER_ID = '__MIRROR__';

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
 * Unified paginated query combining items (own + public) and external_item_cache (srd, fcg, hod).
 * Single OFFSET/LIMIT, no source ordering.
 *
 * @param {object} opts
 * @param {boolean} opts.includeMine
 * @param {boolean} opts.includePublic
 * @param {boolean} opts.includeSrd
 * @param {boolean} opts.includeHod
 * @param {boolean} opts.includeFcg
 * @param {string} opts.search
 * @param {number|null} opts.tierMax
 * @param {number[]} opts.tiers
 * @param {string} opts.typeField - 'role' | 'type'
 * @param {string[]} opts.typeValues
 * @param {string} opts.sort - 'popularity' | 'name' | 'type' | 'source' | 'tier'
 * @param {string} opts.sortDir - 'asc' | 'desc'
 */
export async function getUnifiedItems(appId, userId, collection, {
  includeMine = true,
  includePublic = false,
  includeSrd = false,
  includeHod = false,
  includeFcg = false,
  search = '',
  tierMax = null,
  tiers = [],
  typeField = null,
  typeValues = [],
  sort = 'popularity',
  sortDir = 'asc',
  offset = 0,
  limit = 20,
} = {}) {
  const db = getPool();
  const parts = [];
  const params = [];
  let p = 1;

  const sortOpt = SORT_OPTIONS[sort] || SORT_OPTIONS.popularity;
  const typeExpr = typeField ? `data->>'${typeField}'` : `''`;
  const tierExpr = `COALESCE((data->>'tier')::int, 1)`;

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
        ${tierExpr} AS tier_val
      FROM items i
      WHERE i.app_id = $${p} AND i.collection = $${p + 1} AND (${srcSQL})
    )`);
    params.push(appId, collection);
    p += 2;
  }

  const extSources = [];
  if (includeSrd) extSources.push('srd');
  if (includeHod) extSources.push('hod');
  if (includeFcg) extSources.push('fcg');

  if (extSources.length > 0) {
    parts.push(`(
      SELECT e.external_id AS id, e.data, NULL::text AS user_id, false AS is_public,
        COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = e.app_id AND ip.collection = e.collection AND ip.item_id = e.external_id AND ip.action = 'clone'), 0) AS cc,
        COALESCE((SELECT COUNT(*) FROM item_popularity ip WHERE ip.app_id = e.app_id AND ip.collection = e.collection AND ip.item_id = e.external_id AND ip.action = 'play'), 0) AS pc,
        e.source AS _source,
        ${typeExpr} AS type_val,
        ${tierExpr} AS tier_val
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
    filterClauses.push(`u.tier_val <= $${p}`);
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
  const filterSQL = filterClauses.length > 0 ? 'AND ' + filterClauses.join(' AND ') : '';

  const countParams = [...params];
  const countSQL = `SELECT COUNT(*) AS cnt FROM (${unionSQL}) u WHERE 1=1 ${filterSQL}`;
  const { rows: countRows } = await db.query(countSQL, countParams);
  const totalCount = parseInt(countRows[0]?.cnt ?? 0, 10);

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

/**
 * Find all table_state records whose playerEmails array contains the given email.
 * Used by GET /api/my-rooms to let players discover which GMs have invited them.
 * Returns [{ userId, data }] where userId is the GM's Firebase UID.
 */
export async function getTableStatesByPlayerEmail(appId, email) {
  const db = getPool();
  // Use the ? (key exists in array) JSONB operator to check membership.
  // Note: in node-postgres, ? is not a placeholder — $1/$2 are used for that.
  const { rows } = await db.query(
    `SELECT user_id, data FROM items
     WHERE app_id = $1 AND collection = 'table_state'
     AND data->'playerEmails' ? $2`,
    [appId, email]
  );
  return rows.map(r => ({ userId: r.user_id, data: r.data }));
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

export async function appendDiceRoll(appId, gmUid, rollData) {
  const db = getPool();
  await db.query(
    'INSERT INTO dice_rolls (app_id, gm_uid, data) VALUES ($1, $2, $3)',
    [appId, gmUid, JSON.stringify(rollData)]
  );
}

export async function getRecentDiceRolls(appId, gmUid, limit = 50) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT data FROM dice_rolls
     WHERE app_id = $1 AND gm_uid = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [appId, gmUid, limit]
  );
  // Reverse so oldest-first order matches client expectations
  return rows.map(r => r.data).reverse();
}
