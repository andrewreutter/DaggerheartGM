/**
 * Smoke-tests for the two hand-authored DT catalog scene JSON files
 * (`data/dt-scenes/*.json`).  No DB required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  AUTHORED_SCENE_UUID_TO_CATALOG_ID,
  SHELVED_STARTER_SCENE_IDS,
  STARTER_SCENE_EXCLUDED_SCENE_IDS,
} from '../../src/srd-starter-scenes.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DT_SCENES_DIR = join(REPO_ROOT, 'data', 'dt-scenes');

function loadScene(filename) {
  return JSON.parse(readFileSync(join(DT_SCENES_DIR, filename), 'utf8'));
}

const EXPECTED_CATALOG_IDS = new Set([
  'srd-scene-crossroads-ambush',
  'srd-scene-cross-the-raging-river',
]);

const EXPECTED_UUID_COUNT = 2;

describe('data/dt-scenes/ directory', () => {
  it('contains exactly two JSON files', () => {
    const files = readdirSync(DT_SCENES_DIR).filter((f) => f.endsWith('.json'));
    expect(files).toHaveLength(2);
  });
});

describe('AUTHORED_SCENE_UUID_TO_CATALOG_ID map', () => {
  it('contains exactly two UUIDs', () => {
    expect(Object.keys(AUTHORED_SCENE_UUID_TO_CATALOG_ID)).toHaveLength(EXPECTED_UUID_COUNT);
  });

  it('maps to the expected catalog ids', () => {
    const catalogIds = new Set(Object.values(AUTHORED_SCENE_UUID_TO_CATALOG_ID));
    for (const id of EXPECTED_CATALOG_IDS) {
      expect(catalogIds.has(id)).toBe(true);
    }
  });

  it('catalog ids do not overlap with shelved scene ids', () => {
    const shelved = new Set(SHELVED_STARTER_SCENE_IDS);
    for (const catalogId of Object.values(AUTHORED_SCENE_UUID_TO_CATALOG_ID)) {
      expect(shelved.has(catalogId)).toBe(false);
    }
  });

  it('catalog ids do not overlap with excluded scene ids', () => {
    const excluded = new Set(STARTER_SCENE_EXCLUDED_SCENE_IDS);
    for (const catalogId of Object.values(AUTHORED_SCENE_UUID_TO_CATALOG_ID)) {
      expect(excluded.has(catalogId)).toBe(false);
    }
  });
});

describe.each([
  ['srd-scene-crossroads-ambush.json', 'srd-scene-crossroads-ambush', 'Crossroads Ambush'],
  ['srd-scene-cross-the-raging-river.json', 'srd-scene-cross-the-raging-river', 'Cross the Raging River'],
])('%s', (filename, expectedId, expectedName) => {
  const scene = loadScene(filename);

  it('has the correct stable catalog id', () => {
    expect(scene.id).toBe(expectedId);
  });

  it('has _source dt', () => {
    expect(scene._source).toBe('dt');
  });

  it('has the correct name', () => {
    expect(scene.name).toBe(expectedName);
  });

  it('does not contain owner-only top-level fields', () => {
    expect(scene).not.toHaveProperty('is_public');
    expect(scene).not.toHaveProperty('_clonedFrom');
    expect(scene).not.toHaveProperty('_tableId');
    expect(scene).not.toHaveProperty('_adminEditedAt');
    expect(scene).not.toHaveProperty('play_count');
    expect(scene).not.toHaveProperty('clone_count');
    expect(scene).not.toHaveProperty('popularity');
  });

  it('has at least one map with a Supabase mapImageUrl', () => {
    expect(scene.maps).toBeInstanceOf(Array);
    expect(scene.maps.length).toBeGreaterThanOrEqual(1);
    const url = scene.maps[0]?.mapImageUrl;
    expect(typeof url).toBe('string');
    expect(url).toMatch(/^https?:\/\//);
  });

  it('has mapViews array', () => {
    expect(scene.mapViews).toBeInstanceOf(Array);
    expect(scene.mapViews.length).toBeGreaterThanOrEqual(1);
  });

  it('has activeElements array', () => {
    expect(scene.activeElements).toBeInstanceOf(Array);
  });

  it('has valid partySize if present', () => {
    if (scene.partySize !== undefined) {
      expect(typeof scene.partySize).toBe('number');
      expect(scene.partySize).toBeGreaterThanOrEqual(1);
    }
    if (scene.partyTier !== undefined) {
      expect(typeof scene.partyTier).toBe('number');
      expect(scene.partyTier).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('Crossroads Ambush nextScenes', () => {
  const scene = loadScene('srd-scene-crossroads-ambush.json');

  it('has nextScenes pointing to the catalog id of Cross the Raging River', () => {
    expect(scene.nextScenes).toBeInstanceOf(Array);
    expect(scene.nextScenes.length).toBeGreaterThanOrEqual(1);
    const ids = scene.nextScenes.map((ns) => ns.id);
    expect(ids).toContain('srd-scene-cross-the-raging-river');
  });

  it('nextScenes ids are not UUIDs', () => {
    for (const ns of scene.nextScenes ?? []) {
      expect(ns.id).toMatch(/^srd-scene-/);
    }
  });
});
