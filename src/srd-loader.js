/**
 * Load all SRD collections into external_item_cache on startup.
 * Uses sync_state to detect when the daggerheart-srd submodule has changed.
 */

import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { COLLECTION_NAMES, getCollection } from './srd/parser.js';
import {
  getSyncState,
  setSyncState,
  upsertExternalCache,
  listExternalCacheBySource,
  deleteExternalCacheByIds,
} from './db.js';
import { formatSrdCacheStamp } from './srd-sync-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRD_ROOT = join(__dirname, '..', 'daggerheart-srd');
const JSON_DIR = join(SRD_ROOT, '.build', '03_json');
const SRD_README_PATH = join(SRD_ROOT, 'README.md');
const SRD_TEXT_CHUNKS_DIR = join(__dirname, '..', 'data', 'srd-text-chunks');

/**
 * Hash all built SRD JSON files so any content change invalidates the cache.
 * Prefers git rev-parse of the submodule; falls back to hashing every *.json in 03_json.
 */
export async function getSubmoduleHash() {
  try {
    const rev = execSync('git rev-parse HEAD', { cwd: SRD_ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();
    return rev;
  } catch {
    try {
      const files = (await readdir(JSON_DIR)).filter(f => f.endsWith('.json')).sort();
      const h = createHash('sha256');
      for (const f of files) {
        h.update(f);
        h.update(await readFile(join(JSON_DIR, f), 'utf8'));
      }
      h.update('README.md');
      h.update(await readFile(SRD_README_PATH, 'utf8'));
      try {
        const chunkFiles = (await readdir(SRD_TEXT_CHUNKS_DIR)).filter(f => f.endsWith('.md')).sort();
        for (const f of chunkFiles) {
          h.update(f);
          h.update(await readFile(join(SRD_TEXT_CHUNKS_DIR, f), 'utf8'));
        }
      } catch {
        /* ignore missing chunk dir in hash fallback */
      }
      return h.digest('hex');
    } catch {
      return null;
    }
  }
}

/**
 * Per-id SRD cache sync: skip overwrite when `data._adminEditedAt` is set;
 * delete leftover cache ids that are not admin-edited.
 * @param {{ external_id: string, data?: object }[]} existingRows
 * @param {{ id: string }[]} incomingItems
 */
export function planSrdCollectionCacheSync(existingRows, incomingItems) {
  const existingById = new Map((existingRows || []).map((row) => [row.external_id, row.data]));
  const incomingIds = new Set((incomingItems || []).map((item) => item.id).filter(Boolean));
  const upserts = [];
  for (const item of incomingItems || []) {
    if (!item?.id) continue;
    const existing = existingById.get(item.id);
    if (existing?._adminEditedAt) continue;
    upserts.push(item);
  }
  const deleteIds = [];
  for (const row of existingRows || []) {
    if (!row?.external_id) continue;
    if (incomingIds.has(row.external_id)) continue;
    if (row.data?._adminEditedAt) continue;
    deleteIds.push(row.external_id);
  }
  return { upserts, deleteIds };
}

/**
 * Load all SRD collections into external_item_cache.
 * If the current hash matches sync_state, skip. Otherwise per-id upsert,
 * preserving admin-edited rows (`data._adminEditedAt`).
 */
export async function loadSrdIntoDb(appId) {
  const currentHash = await getSubmoduleHash();
  const cacheStamp = formatSrdCacheStamp(currentHash);
  if (!cacheStamp) {
    console.warn('[srd-loader] Could not compute SRD hash — skipping DB load');
    return;
  }

  const storedHash = await getSyncState(appId, 'srd_hash');
  // `storedHash` may be legacy bare git SHA (pre–full-SRD-cache); revision prefix forces one-time reload.
  if (storedHash === cacheStamp) {
    return;
  }

  const counts = {};
  for (const collection of COLLECTION_NAMES) {
    const rows = await getCollection(collection);
    const existing = await listExternalCacheBySource(appId, 'srd', collection);
    const { upserts, deleteIds } = planSrdCollectionCacheSync(existing, rows || []);
    if (deleteIds.length) {
      await deleteExternalCacheByIds(appId, 'srd', collection, deleteIds);
    }
    for (const item of upserts) {
      const { id, ...data } = item;
      await upsertExternalCache(appId, 'srd', collection, id, { ...data, _source: 'srd' }, '');
    }
    counts[collection] = rows?.length ?? 0;
  }

  await setSyncState(appId, 'srd_hash', cacheStamp);
  const summary = COLLECTION_NAMES.map(c => `${c}:${counts[c] ?? 0}`).join(', ');
  console.log(`[srd-loader] Loaded SRD into external_item_cache — ${summary}`);
}
