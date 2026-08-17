/**
 * Load DT catalog maps (`data/dt-maps/*.json`) into `external_item_cache`
 * (`source='dt'`, `collection='maps'`).
 */

import { createHash } from 'crypto';
import { readdir, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getSyncState, setSyncState, upsertExternalCache, getExternalCacheByIds } from './db.js';
import { STARTER_SCENE_CACHE_SOURCE, shouldSkipAdminEditedStarterScene } from './srd-starter-scenes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DT_MAPS_DIR = join(__dirname, '..', 'data', 'dt-maps');
export const DT_MAPS_SYNC_KEY = 'dt_maps_hash';
export const DT_MAPS_CACHE_REVISION = '1';

export function formatDtMapsCacheStamp(contentHash) {
  if (!contentHash) return null;
  return `${DT_MAPS_CACHE_REVISION}:${contentHash}`;
}

export function hashAuthoredDtMaps(files) {
  const h = createHash('sha256');
  for (const file of [...files].sort((a, b) => a.filename.localeCompare(b.filename))) {
    h.update(file.filename);
    h.update('\0');
    h.update(file.raw);
    h.update('\0');
  }
  return h.digest('hex');
}

export async function readAuthoredDtMapFiles(dir = DT_MAPS_DIR) {
  let names;
  try {
    names = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
  const files = [];
  for (const filename of names) {
    const raw = await readFile(join(dir, filename), 'utf8');
    const parsed = JSON.parse(raw);
    const { id, ...rest } = parsed;
    if (!id) continue;
    files.push({ filename, raw, id, map: { id, ...rest } });
  }
  return files;
}

export async function loadDtMapsIntoDb(appId, { force = false } = {}) {
  const files = await readAuthoredDtMapFiles();
  if (!files.length) return { skipped: true, upserted: 0 };
  const stamp = formatDtMapsCacheStamp(hashAuthoredDtMaps(files));
  if (!force && stamp) {
    const stored = await getSyncState(appId, DT_MAPS_SYNC_KEY);
    if (stored === stamp) return { skipped: true, upserted: 0 };
  }
  const existing = await getExternalCacheByIds(appId, 'maps', files.map((f) => f.id));
  const existingById = new Map();
  for (const row of existing || []) {
    const id = row?.id || row?.external_id;
    if (id) existingById.set(id, row);
  }
  let upserted = 0;
  for (const file of files) {
    const existingRow = existingById.get(file.id);
    const existingData = existingRow?.data?._adminEditedAt ? existingRow.data : existingRow;
    if (shouldSkipAdminEditedStarterScene(existingData, { force })) continue;
    const { id, ...mapData } = file.map;
    await upsertExternalCache(appId, STARTER_SCENE_CACHE_SOURCE, 'maps', id, mapData, '');
    upserted += 1;
  }
  if (stamp) await setSyncState(appId, DT_MAPS_SYNC_KEY, stamp);
  console.log(`[dt-maps] Loaded ${upserted} catalog map(s) into external_item_cache`);
  return { skipped: false, upserted };
}
