/**
 * Load SRD adversaries and environments into external_item_cache on startup.
 * Uses sync_state to detect when the daggerheart-srd submodule has changed.
 */

import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getCollection } from './srd/parser.js';
import { getSyncState, setSyncState, upsertExternalCache, deleteExternalCacheBySource } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRD_ROOT = join(__dirname, '..', 'daggerheart-srd');
const JSON_DIR = join(SRD_ROOT, '.build', '03_json');

/**
 * Get a hash of the SRD content (adversaries + environments JSON).
 * Uses git rev-parse if submodule exists, else hashes the file contents.
 */
export async function getSubmoduleHash() {
  try {
    const rev = execSync('git rev-parse HEAD', { cwd: SRD_ROOT, encoding: 'utf8' }).trim();
    return rev;
  } catch {
    try {
      const adv = await readFile(join(JSON_DIR, 'adversaries.json'), 'utf8');
      const env = await readFile(join(JSON_DIR, 'environments.json'), 'utf8');
      return createHash('sha256').update(adv + env).digest('hex');
    } catch {
      return null;
    }
  }
}

/**
 * Load SRD adversaries and environments into external_item_cache.
 * If the current hash matches sync_state, skip. Otherwise truncate SRD rows and reload.
 */
export async function loadSrdIntoDb(appId) {
  const currentHash = await getSubmoduleHash();
  if (!currentHash) {
    console.warn('[srd-loader] Could not compute SRD hash — skipping DB load');
    return;
  }

  const storedHash = await getSyncState(appId, 'srd_hash');
  if (storedHash === currentHash) {
    return;
  }

  await deleteExternalCacheBySource(appId, 'srd', 'adversaries');
  await deleteExternalCacheBySource(appId, 'srd', 'environments');

  const adversaries = await getCollection('adversaries');
  const environments = await getCollection('environments');

  if (adversaries) {
    for (const item of adversaries) {
      const { id, ...data } = item;
      await upsertExternalCache(appId, 'srd', 'adversaries', id, { ...data, _source: 'srd' }, '');
    }
  }
  if (environments) {
    for (const item of environments) {
      const { id, ...data } = item;
      await upsertExternalCache(appId, 'srd', 'environments', id, { ...data, _source: 'srd' }, '');
    }
  }

  await setSyncState(appId, 'srd_hash', currentHash);
  console.log(`[srd-loader] Loaded ${adversaries?.length ?? 0} adversaries, ${environments?.length ?? 0} environments into cache`);
}
