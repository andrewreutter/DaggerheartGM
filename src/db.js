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
    `SELECT id, user_id, data, clone_count, play_count FROM items
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
 */
function buildFilterSQL(baseParamCount, { search = '', tier = null, typeField = null, typeValue = null } = {}) {
  const clauses = [];
  const params = [];
  let idx = baseParamCount + 1;

  if (search) {
    clauses.push(`data->>'name' ILIKE '%' || $${idx} || '%'`);
    params.push(search);
    idx++;
  }
  if (tier != null) {
    clauses.push(`data->>'tier' = $${idx}`);
    params.push(String(tier));
    idx++;
  }
  if (typeField && typeValue) {
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
  typeField = null,
  typeValue = null,
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

  const { sql: filterSQL, params: filterParams } = buildFilterSQL(baseParamCount + extraParams.length, { search, tier, typeField, typeValue });

  return { sql: sourceSQL + ' ' + filterSQL, params: [...extraParams, ...filterParams] };
}

// --- Own-item paginated helpers ---

export async function countItems(appId, userId, collection, { search = '', tier = null, typeField = null, typeValue = null } = {}) {
  const db = getPool();
  const base = [appId, userId, collection];
  const { sql, params: fp } = buildFilterSQL(base.length, { search, tier, typeField, typeValue });
  const { rows } = await db.query(
    `SELECT COUNT(*) FROM items WHERE app_id = $1 AND user_id = $2 AND collection = $3 ${sql}`,
    [...base, ...fp]
  );
  return parseInt(rows[0].count, 10);
}

export async function getItemsPaginated(appId, userId, collection, { search = '', tier = null, typeField = null, typeValue = null, offset = 0, limit = 20 } = {}) {
  const db = getPool();
  const base = [appId, userId, collection];
  const { sql, params: fp } = buildFilterSQL(base.length, { search, tier, typeField, typeValue });
  const offsetIdx = base.length + fp.length + 1;
  const limitIdx = offsetIdx + 1;
  const { rows } = await db.query(
    `SELECT id, data, is_public, clone_count, play_count FROM items
     WHERE app_id = $1 AND user_id = $2 AND collection = $3 ${sql}
     ORDER BY (clone_count + play_count) DESC, data->>'name' ASC
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
  typeField = null,
  typeValue = null,
} = {}) {
  const db = getPool();
  const base = [appId, collection];
  const { sql, params: cp } = buildCommunitySQL(base.length, { includePublic, includeMirrors, excludeUserId, search, tier, typeField, typeValue });
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
  typeField = null,
  typeValue = null,
  offset = 0,
  limit = 20,
} = {}) {
  const db = getPool();
  const base = [appId, collection];
  const { sql, params: cp } = buildCommunitySQL(base.length, { includePublic, includeMirrors, excludeUserId, search, tier, typeField, typeValue });
  const offsetIdx = base.length + cp.length + 1;
  const limitIdx = offsetIdx + 1;
  const { rows } = await db.query(
    `SELECT id, user_id, data, is_public, clone_count, play_count FROM items
     WHERE app_id = $1 AND collection = $2 ${sql}
     ORDER BY (clone_count + play_count) DESC, data->>'name' ASC
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
export async function getMirrorIds(appId, collection, { search = '', tier = null, typeField = null, typeValue = null } = {}) {
  const db = getPool();
  const base = [appId, MIRROR_USER_ID, collection];
  const { sql, params: fp } = buildFilterSQL(base.length, { search, tier, typeField, typeValue });
  const { rows } = await db.query(
    `SELECT id FROM items WHERE app_id = $1 AND user_id = $2 AND collection = $3 ${sql}`,
    [...base, ...fp]
  );
  return rows.map(r => r.id);
}

// --- Popularity helpers ---

/**
 * Increment clone_count on any item (own, SRD, mirror) by its (appId, collection, id).
 */
export async function incrementCloneCount(appId, collection, id) {
  const db = getPool();
  await db.query(
    `UPDATE items SET clone_count = clone_count + 1, updated_at = now()
     WHERE app_id = $1 AND collection = $2 AND id = $3`,
    [appId, collection, id]
  );
}

/**
 * Increment play_count on any item (own, SRD, mirror) by its (appId, collection, id).
 */
export async function incrementPlayCount(appId, collection, id) {
  const db = getPool();
  await db.query(
    `UPDATE items SET play_count = play_count + 1, updated_at = now()
     WHERE app_id = $1 AND collection = $2 AND id = $3`,
    [appId, collection, id]
  );
}

/**
 * Upsert a mirror row for an external item, atomically incrementing counts.
 * cloneDelta / playDelta should each be 0 or 1 depending on the action.
 */
export async function upsertMirror(appId, collection, id, data, { cloneDelta = 0, playDelta = 0 } = {}) {
  const db = getPool();
  const { rows } = await db.query(
    `INSERT INTO items (id, app_id, user_id, collection, data, is_public, clone_count, play_count)
     VALUES ($1, $2, $3, $4, $5, false, $6, $7)
     ON CONFLICT (app_id, collection, id)
     DO UPDATE SET
       clone_count = items.clone_count + EXCLUDED.clone_count,
       play_count  = items.play_count  + EXCLUDED.play_count,
       data        = EXCLUDED.data,
       updated_at  = now()
     RETURNING id, clone_count, play_count`,
    [id, appId, MIRROR_USER_ID, collection, data, cloneDelta, playDelta]
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
    `SELECT id, data, is_public, clone_count, play_count FROM items
     WHERE app_id = $1 AND user_id = $2 AND collection = $3
       AND data->>'_clonedFrom' = $4
     LIMIT 1`,
    [appId, userId, collection, sourceId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, ...r.data, is_public: r.is_public, clone_count: r.clone_count, play_count: r.play_count, _source: 'own' };
}

// --- Resolve by IDs ---

export async function getItemsByIds(appId, collection, ids) {
  if (!ids || ids.length === 0) return [];
  const db = getPool();
  const { rows } = await db.query(
    `SELECT id, user_id, data, is_public, clone_count, play_count FROM items
     WHERE app_id = $1 AND collection = $2 AND id = ANY($3)`,
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
     ON CONFLICT (app_id, collection, id)
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

// --- Reddit mirror helpers (queue + library source) ---

const REDDIT_RESERVED_STATUSES = new Set(['needs_review', 'parsed', 'failed']);

/**
 * Count Reddit mirror rows with a given _redditStatus.
 * If status is null, counts ALL non-parsed statuses (for queue badge).
 */
export async function countRedditMirrors(appId, collection, {
  status = null,
  search = '',
  tier = null,
  typeField = null,
  typeValue = null,
} = {}) {
  const db = getPool();
  const params = [appId, MIRROR_USER_ID];
  let idx = params.length + 1;
  const clauses = [`app_id = $1`, `user_id = $2`, `(data->>'_source') = 'reddit'`];

  if (collection) {
    clauses.push(`collection = $${idx++}`);
    params.push(collection);
  }
  if (status !== null) {
    clauses.push(`(data->>'_redditStatus') = $${idx++}`);
    params.push(status);
  }
  if (search) {
    clauses.push(`data->>'name' ILIKE '%' || $${idx++} || '%'`);
    params.push(search);
  }
  if (tier != null) {
    clauses.push(`data->>'tier' = $${idx++}`);
    params.push(String(tier));
  }
  if (typeField && typeValue) {
    clauses.push(`data->>'${typeField}' = $${idx++}`);
    params.push(typeValue);
  }

  const { rows } = await db.query(
    `SELECT COUNT(*) FROM items WHERE ${clauses.join(' AND ')}`,
    params
  );
  return parseInt(rows[0].count, 10);
}

/**
 * Paginated fetch of Reddit mirrors for the Library (status = 'parsed').
 * Returns { items, totalCount }.
 */
export async function getRedditMirrorsPaginated(appId, collection, {
  search = '',
  tier = null,
  typeField = null,
  typeValue = null,
  offset = 0,
  limit = 20,
} = {}) {
  const db = getPool();
  const params = [appId, MIRROR_USER_ID, collection];
  let idx = params.length + 1;
  const filterClauses = [
    `app_id = $1`,
    `user_id = $2`,
    `collection = $3`,
    `(data->>'_source') = 'reddit'`,
    `(data->>'_redditStatus') = 'parsed'`,
  ];

  if (search) {
    filterClauses.push(`data->>'name' ILIKE '%' || $${idx++} || '%'`);
    params.push(search);
  }
  if (tier != null) {
    filterClauses.push(`data->>'tier' = $${idx++}`);
    params.push(String(tier));
  }
  if (typeField && typeValue) {
    filterClauses.push(`data->>'${typeField}' = $${idx++}`);
    params.push(typeValue);
  }

  const where = filterClauses.join(' AND ');
  const countRow = await db.query(`SELECT COUNT(*) FROM items WHERE ${where}`, params);
  const totalCount = parseInt(countRow.rows[0].count, 10);

  const offsetIdx = idx++;
  const limitIdx = idx++;
  const { rows } = await db.query(
    `SELECT id, data, clone_count, play_count FROM items
     WHERE ${where}
     ORDER BY (clone_count + play_count) DESC, data->>'name' ASC
     OFFSET $${offsetIdx} LIMIT $${limitIdx}`,
    [...params, offset, limit]
  );

  const items = rows.map(r => ({
    id: r.id,
    ...r.data,
    clone_count: r.clone_count,
    play_count: r.play_count,
    _source: 'reddit',
  }));

  return { items, totalCount };
}

/**
 * Paginated fetch of Reddit mirrors for the admin queue.
 * collection may be null to query across both adversaries + environments.
 */
export async function getRedditQueuePaginated(appId, {
  status,
  collection = null,
  search = '',
  offset = 0,
  limit = 20,
} = {}) {
  const db = getPool();
  const params = [appId, MIRROR_USER_ID];
  let idx = params.length + 1;
  const clauses = [
    `app_id = $1`,
    `user_id = $2`,
    `(data->>'_source') = 'reddit'`,
    `(data->>'_redditStatus') = $${idx++}`,
  ];
  params.push(status);

  if (collection) {
    clauses.push(`collection = $${idx++}`);
    params.push(collection);
  }
  if (search) {
    clauses.push(`data->>'name' ILIKE '%' || $${idx++} || '%'`);
    params.push(search);
  }

  const where = clauses.join(' AND ');
  const offsetIdx = idx++;
  const limitIdx = idx++;
  const { rows } = await db.query(
    `SELECT id, collection, data, clone_count, play_count, COUNT(*) OVER() AS total_count FROM items
     WHERE ${where}
     ORDER BY created_at DESC
     OFFSET $${offsetIdx} LIMIT $${limitIdx}`,
    [...params, offset, limit]
  );

  const totalCount = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  const items = rows.map(r => ({
    id: r.id,
    collection: r.collection,
    ...r.data,
    clone_count: r.clone_count,
    play_count: r.play_count,
    _source: 'reddit',
  }));

  return { items, totalCount };
}

/**
 * Returns counts for ALL non-parsed _redditStatus values across both collections.
 * Used to populate the queue sub-nav tabs.
 * Returns an object like { needs_review: 47, failed: 3, "Not Daggerheart": 12 }.
 */
export async function getRedditStatusCounts(appId) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT data->>'_redditStatus' AS status, COUNT(*) AS count
     FROM items
     WHERE app_id = $1
       AND user_id = $2
       AND (data->>'_source') = 'reddit'
       AND (data->>'_redditStatus') != 'parsed'
       AND (data->>'_redditStatus') IS NOT NULL
     GROUP BY data->>'_redditStatus'`,
    [appId, MIRROR_USER_ID]
  );
  const result = {};
  for (const row of rows) {
    result[row.status] = parseInt(row.count, 10);
  }
  return result;
}

/**
 * Set _redditStatus on a Reddit mirror item (for admin triage).
 * Also updates _redditTag when the status is a custom tag.
 * Returns the updated mirror data.
 */
export async function setRedditMirrorStatus(appId, collection, id, status) {
  const db = getPool();
  const { rows } = await db.query(
    `UPDATE items
     SET data = jsonb_set(jsonb_set(data, '{_redditStatus}', $4::jsonb), '{_redditTag}', $5::jsonb),
         updated_at = now()
     WHERE app_id = $1 AND collection = $2 AND id = $3 AND user_id = $6
     RETURNING id, data`,
    [
      appId,
      collection,
      id,
      JSON.stringify(status),
      JSON.stringify(REDDIT_RESERVED_STATUSES.has(status) ? null : status),
      MIRROR_USER_ID,
    ]
  );
  if (!rows.length) return null;
  return { id: rows[0].id, ...rows[0].data, _source: 'reddit' };
}

/**
 * Check which Reddit post IDs (format: reddit-XXXX) already have a mirror row.
 * Returns a Set of existing IDs.
 */
export async function getExistingRedditMirrorIds(appId, ids) {
  if (!ids || ids.length === 0) return new Set();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT id FROM items
     WHERE app_id = $1 AND user_id = $2 AND id = ANY($3)`,
    [appId, MIRROR_USER_ID, ids]
  );
  return new Set(rows.map(r => r.id));
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
 * Remove a Reddit post from the blocked list (used when re-queuing a tagged item).
 */
export async function unblockRedditPost(appId, redditPostId) {
  const db = getPool();
  await db.query(
    `DELETE FROM blocked_reddit_posts WHERE app_id = $1 AND reddit_post_id = $2`,
    [appId, redditPostId]
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
