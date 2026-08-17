/**
 * Load hand-authored DT catalog scenes (`data/dt-scenes/*.json`) into
 * `external_item_cache` (`source='dt'`, `collection='scenes'`).
 *
 * Called on server startup (same gate as `loadSrdIntoDb`) so production gets
 * Crossroads Ambush / Cross the Raging River without a manual seed. The CLI
 * `npm run generate:srd-scenes` reuses this path.
 */

import { createHash } from 'crypto';
import { readdir, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  getSyncState,
  setSyncState,
  upsertExternalCache,
  getExternalCacheByIds,
  getPool,
} from './db.js';
import {
  AUTHORED_SCENE_UUID_TO_CATALOG_ID,
  SHELVED_STARTER_SCENE_IDS,
  STARTER_SCENE_CACHE_SOURCE,
  STARTER_SCENE_EXCLUDED_SCENE_IDS,
  shouldSkipAdminEditedStarterScene,
} from './srd-starter-scenes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DT_SCENES_DIR = join(__dirname, '..', 'data', 'dt-scenes');

/** `sync_state` key for the authored DT scene file digest. */
export const DT_SCENES_SYNC_KEY = 'dt_scenes_hash';

/**
 * Bump when loader semantics change so existing DBs re-seed without a file edit.
 * `sync_state.dt_scenes_hash` stores `${REVISION}:${contentHash}`.
 */
export const DT_SCENES_CACHE_REVISION = '1';

/** @param {string | null | undefined} contentHash */
export function formatDtScenesCacheStamp(contentHash) {
  if (!contentHash) return null;
  return `${DT_SCENES_CACHE_REVISION}:${contentHash}`;
}

/**
 * @param {{ filename: string, raw: string }[]} files
 * @returns {string}
 */
export function hashAuthoredDtScenes(files) {
  const h = createHash('sha256');
  for (const file of [...files].sort((a, b) => a.filename.localeCompare(b.filename))) {
    h.update(file.filename);
    h.update('\0');
    h.update(file.raw);
    h.update('\0');
  }
  return h.digest('hex');
}

/**
 * @param {string} [dir]
 * @returns {Promise<{ filename: string, raw: string, id: string, scene: object }[]>}
 */
export async function readAuthoredDtSceneFiles(dir = DT_SCENES_DIR) {
  let names;
  try {
    names = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw new Error(`DT scenes directory not found: ${dir}`);
    }
    throw err;
  }

  const files = [];
  for (const filename of names) {
    const raw = await readFile(join(dir, filename), 'utf8');
    const parsed = JSON.parse(raw);
    const { id, ...rest } = parsed;
    if (!id) continue;
    files.push({ filename, raw, id, scene: { id, ...rest } });
  }
  return files;
}

/**
 * @param {object[]} existingRows — `getExternalCacheByIds` rows (id + data fields)
 * @param {{ id: string }[]} incomingScenes
 * @param {{ force?: boolean }} [opts]
 * @returns {{ upserts: object[] }}
 */
export function planDtScenesCacheSync(existingRows, incomingScenes, { force = false } = {}) {
  const existingById = new Map();
  for (const row of existingRows || []) {
    const id = row?.id || row?.external_id;
    if (id) existingById.set(id, row);
  }
  const upserts = [];
  for (const scene of incomingScenes || []) {
    if (!scene?.id) continue;
    const existing = existingById.get(scene.id);
    const existingData = existing?.data?._adminEditedAt ? existing.data : existing;
    if (shouldSkipAdminEditedStarterScene(existingData, { force })) continue;
    upserts.push(scene);
  }
  return { upserts };
}

async function deleteShelvedAndExcludedScenes(appId) {
  const ids = [...SHELVED_STARTER_SCENE_IDS, ...STARTER_SCENE_EXCLUDED_SCENE_IDS];
  if (!ids.length) return 0;
  const { rowCount } = await getPool().query(
    `DELETE FROM external_item_cache
     WHERE app_id = $1 AND source = ANY($2::text[]) AND collection = 'scenes' AND external_id = ANY($3)`,
    [appId, [STARTER_SCENE_CACHE_SOURCE, 'srd'], ids],
  );
  return rowCount ?? 0;
}

async function unpublishOriginalAuthoredSceneItems(appId) {
  const uuids = Object.keys(AUTHORED_SCENE_UUID_TO_CATALOG_ID);
  if (!uuids.length) return 0;
  const { rowCount } = await getPool().query(
    `UPDATE items SET is_public = false
     WHERE app_id = $1 AND collection = 'scenes' AND id = ANY($2) AND is_public = true`,
    [appId, uuids],
  );
  return rowCount ?? 0;
}

/**
 * Upsert authored DT scenes when the file digest changed (or `force` is set).
 * @param {string} appId
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<{ skipped: boolean, upserted: number, skippedAdmin: number, removedShelved: number, unpublished: number }>}
 */
export async function loadDtScenesIntoDb(appId, { force = false } = {}) {
  const files = await readAuthoredDtSceneFiles();
  const stamp = formatDtScenesCacheStamp(hashAuthoredDtScenes(files));
  if (!force && stamp) {
    const stored = await getSyncState(appId, DT_SCENES_SYNC_KEY);
    if (stored === stamp) {
      return { skipped: true, upserted: 0, skippedAdmin: 0, removedShelved: 0, unpublished: 0 };
    }
  }

  const removedShelved = await deleteShelvedAndExcludedScenes(appId);

  const existing = await getExternalCacheByIds(appId, 'scenes', files.map((f) => f.id));
  const incoming = files.map((f) => f.scene);
  const { upserts } = planDtScenesCacheSync(existing, incoming, { force });

  for (const scene of upserts) {
    const { id, ...sceneData } = scene;
    await upsertExternalCache(appId, STARTER_SCENE_CACHE_SOURCE, 'scenes', id, sceneData, '');
  }

  const unpublished = await unpublishOriginalAuthoredSceneItems(appId);
  if (stamp) await setSyncState(appId, DT_SCENES_SYNC_KEY, stamp);

  const names = upserts.map((s) => s.name || s.id).join(', ');
  console.log(`[dt-scenes] Loaded ${upserts.length} authored scene(s) into external_item_cache${names ? ` — ${names}` : ''}`);

  return {
    skipped: false,
    upserted: upserts.length,
    skippedAdmin: incoming.length - upserts.length,
    removedShelved,
    unpublished,
  };
}
