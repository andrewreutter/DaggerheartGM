#!/usr/bin/env node
/**
 * Generate one SRD starter scene per environment (except Ambushed / Ambushers)
 * and upsert into `external_item_cache` (source `dt`, collection `scenes`).
 *
 * Required env:
 *   DATABASE_URL
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   APP_ID — defaults to daggerheart-gm-tool (same as server.js / loadSrdIntoDb)
 *
 * Idempotent: scene ids are stable (`srd-scene-{slug}`); re-running replaces rows
 * unless the row has `_adminEditedAt` (pass `--force` to overwrite those).
 * Map image URLs get a new Storage UUID each upload — that's OK.
 *
 * Does not touch loadSrdIntoDb() or SRD_EXTERNAL_CACHE_REVISION.
 *
 * Run: npm run generate:srd-scenes [-- --force]
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getCollection } from '../src/srd/parser.js';
import { upsertExternalCache, getExternalCacheByIds, getPool } from '../src/db.js';
import { uploadBufferToMapStorage } from '../src/server/map-storage.js';
import {
  buildSrdStarterScene,
  buildScenePlaceholderSvg,
  shouldGenerateStarterScene,
  shouldSkipAdminEditedStarterScene,
  STARTER_SCENE_EXCLUDED_SCENE_IDS,
  STARTER_SCENE_CACHE_SOURCE,
} from '../src/srd-starter-scenes.js';

const APP_ID = process.env.APP_ID || 'daggerheart-gm-tool';
const SRD_PUBLIC_OWNER_UID = 'srd-public';
const REQUIRED_ENV = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const FORCE = process.argv.includes('--force');

function requireEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required env: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function deleteExcludedStarterScenes() {
  const ids = [...STARTER_SCENE_EXCLUDED_SCENE_IDS];
  if (!ids.length) return;
  const { rowCount } = await getPool().query(
    `DELETE FROM external_item_cache
     WHERE app_id = $1 AND source = ANY($2::text[]) AND collection = 'scenes' AND external_id = ANY($3)`,
    [APP_ID, [STARTER_SCENE_CACHE_SOURCE, 'srd'], ids],
  );
  if (rowCount) {
    console.log(`[srd-scenes] Removed ${rowCount} excluded starter scene(s): ${ids.join(', ')}`);
  }
}

function buildAdversaryLookup(adversaries) {
  const byId = {};
  for (const adv of adversaries || []) {
    if (adv?.id) byId[adv.id] = adv;
  }
  return byId;
}

async function main() {
  requireEnv();

  const environments = await getCollection('environments');
  const adversaries = await getCollection('adversaries');
  if (!environments?.length) {
    console.error(
      'No SRD environments found. Initialize the daggerheart-srd submodule (`git submodule update --init`) and ensure `.build/03_json` exists.',
    );
    process.exit(1);
  }

  const supabase = createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const adversaryById = buildAdversaryLookup(adversaries);

  console.log(
    `[srd-scenes] ${environments.length} environment(s), ${adversaries?.length ?? 0} adversary(ies). Uploading placeholders and upserting scenes…`,
  );

  await deleteExcludedStarterScenes();

  let count = 0;
  let skippedAdmin = 0;
  for (const env of environments) {
    if (!shouldGenerateStarterScene(env)) {
      console.log(`  skip  ${env.id}  ${env.name}  (no starter scene)`);
      continue;
    }

    const preview = buildSrdStarterScene(env, { adversaryById, mapImageUrl: 'pending' });
    const existingRows = await getExternalCacheByIds(APP_ID, 'scenes', [preview.id]);
    if (shouldSkipAdminEditedStarterScene(existingRows[0], { force: FORCE })) {
      console.log(`  skip  ${preview.id}  ${preview.name}  (admin-edited)`);
      skippedAdmin += 1;
      continue;
    }

    const svg = buildScenePlaceholderSvg(env.name);
    const mapImageUrl = await uploadBufferToMapStorage(
      supabase,
      SRD_PUBLIC_OWNER_UID,
      Buffer.from(svg, 'utf8'),
      'image/svg+xml',
      'map-images',
    );
    if (!mapImageUrl) {
      console.error(`[srd-scenes] Upload returned no URL for "${env.name}"`);
      process.exit(1);
    }

    const scene = buildSrdStarterScene(env, { adversaryById, mapImageUrl });
    const { id, ...sceneData } = scene;
    await upsertExternalCache(APP_ID, STARTER_SCENE_CACHE_SOURCE, 'scenes', id, { ...sceneData, _source: STARTER_SCENE_CACHE_SOURCE }, '');

    const advCount = scene.activeElements.filter((el) => el.elementType === 'adversary').length;
    console.log(`  ${id}  ${scene.name}  tier=${scene.tier} bp=${scene.bp} adversaries=${advCount}`);
    count += 1;
  }

  console.log(`[srd-scenes] Upserted ${count} starter scene(s) into external_item_cache.`);
  if (skippedAdmin) {
    console.log(`[srd-scenes] Skipped ${skippedAdmin} admin-edited scene(s). Re-run with --force to overwrite.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      /* pool may never have been created */
    }
  });
