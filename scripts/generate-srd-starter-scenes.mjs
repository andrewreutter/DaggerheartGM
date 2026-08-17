#!/usr/bin/env node
/**
 * Seed the DT catalog scenes into `external_item_cache`.
 *
 * DEFAULT behaviour (`npm run generate:srd-scenes`):
 *   1. DELETE the 17 auto-generated environment scenes (SHELVED_STARTER_SCENE_IDS) plus
 *      the historical excluded pair (STARTER_SCENE_EXCLUDED_SCENE_IDS) from external_item_cache.
 *   2. Upsert the two hand-authored JSON files from `data/dt-scenes/` into
 *      external_item_cache (source='dt').  Rows with _adminEditedAt are skipped unless
 *      --force is passed.
 *   3. UPDATE items SET is_public = false for the two original UUID copies, so they no
 *      longer appear under "Public" and do not duplicate the DT catalog entries.
 *
 * LEGACY behaviour (`npm run generate:srd-scenes -- --from-environments`):
 *   Generates one scene per SRD environment (except Ambushed / Ambushers), uploading
 *   SVG placeholder map images to Supabase Storage.  This restores the old 17 scenes
 *   and is opt-in only.  Requires DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Optional flags:
 *   --force            Overwrite even rows that have _adminEditedAt.
 *   --from-environments  Use the old per-environment generator (legacy mode).
 *
 * Required env (legacy mode also needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
 *   DATABASE_URL
 *
 * Server startup also runs `loadDtScenesIntoDb` (same default-mode path) so a
 * deploy seeds production without a separate CLI step.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getCollection } from '../src/srd/parser.js';
import { upsertExternalCache, getExternalCacheByIds, getPool } from '../src/db.js';
import { uploadBufferToMapStorage } from '../src/server/map-storage.js';
import { loadDtScenesIntoDb } from '../src/dt-scenes-loader.js';
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
const FORCE = process.argv.includes('--force');
const FROM_ENVIRONMENTS = process.argv.includes('--from-environments');

function requireEnv(keys) {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required env: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// DEFAULT mode: upsert the two hand-authored JSON files
// ---------------------------------------------------------------------------

async function seedAuthoredScenes() {
  requireEnv(['DATABASE_URL']);

  console.log('[srd-scenes] Default mode: seeding two hand-authored DT scenes.');
  const result = await loadDtScenesIntoDb(APP_ID, { force: FORCE });
  if (result.skipped) {
    console.log('[srd-scenes] Cache already matches data/dt-scenes/ (use --force to overwrite).');
    return;
  }
  if (result.removedShelved) {
    console.log(`[srd-scenes] Removed ${result.removedShelved} shelved/excluded scene(s) from cache.`);
  }
  console.log(`[srd-scenes] Upserted ${result.upserted} authored scene(s) into external_item_cache.`);
  if (result.skippedAdmin) {
    console.log(`[srd-scenes] Skipped ${result.skippedAdmin} admin-edited scene(s). Re-run with --force to overwrite.`);
  }
  if (result.unpublished) {
    console.log(`[srd-scenes] Un-published ${result.unpublished} original items row(s) (UUID copies will remain Mine-only).`);
  }
}

// ---------------------------------------------------------------------------
// LEGACY mode: per-environment generator (opt-in via --from-environments)
// ---------------------------------------------------------------------------

function buildAdversaryLookup(adversaries) {
  const byId = {};
  for (const adv of adversaries || []) {
    if (adv?.id) byId[adv.id] = adv;
  }
  return byId;
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

async function seedFromEnvironments() {
  requireEnv(['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

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
    `[srd-scenes] --from-environments: ${environments.length} environment(s), ${adversaries?.length ?? 0} adversary(ies). Uploading placeholders and upserting scenes…`,
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

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  if (FROM_ENVIRONMENTS) {
    await seedFromEnvironments();
  } else {
    await seedAuthoredScenes();
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
