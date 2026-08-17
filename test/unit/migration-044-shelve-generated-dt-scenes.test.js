import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  SHELVED_STARTER_SCENE_IDS,
  STARTER_SCENE_EXCLUDED_SCENE_IDS,
} from '../../src/srd-starter-scenes.js';

const MIGRATION_SQL = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../migrations/044_shelve_generated_dt_scenes.sql'),
  'utf8',
);

describe('migration 044 SQL content', () => {
  it('deletes from external_item_cache', () => {
    expect(MIGRATION_SQL).toMatch(/DELETE FROM external_item_cache/i);
  });

  it('scopes to scenes collection and dt/srd sources', () => {
    expect(MIGRATION_SQL).toMatch(/collection = 'scenes'/);
    expect(MIGRATION_SQL).toMatch(/source IN \('dt', 'srd'\)/);
  });

  it('includes all 17 shelved scene ids', () => {
    for (const id of SHELVED_STARTER_SCENE_IDS) {
      expect(MIGRATION_SQL).toContain(`'${id}'`);
    }
  });

  it('also includes the historical excluded pair as a safety no-op', () => {
    for (const id of STARTER_SCENE_EXCLUDED_SCENE_IDS) {
      expect(MIGRATION_SQL).toContain(`'${id}'`);
    }
  });
});

describe('SHELVED_STARTER_SCENE_IDS list', () => {
  it('contains exactly 17 entries', () => {
    expect(SHELVED_STARTER_SCENE_IDS).toHaveLength(17);
  });

  it('all ids start with srd-scene-', () => {
    for (const id of SHELVED_STARTER_SCENE_IDS) {
      expect(id).toMatch(/^srd-scene-/);
    }
  });

  it('does not overlap with the authored catalog ids', () => {
    const authoredIds = new Set([
      'srd-scene-crossroads-ambush',
      'srd-scene-cross-the-raging-river',
    ]);
    for (const id of SHELVED_STARTER_SCENE_IDS) {
      expect(authoredIds.has(id)).toBe(false);
    }
  });

  it('does not overlap with STARTER_SCENE_EXCLUDED_SCENE_IDS', () => {
    const excluded = new Set(STARTER_SCENE_EXCLUDED_SCENE_IDS);
    for (const id of SHELVED_STARTER_SCENE_IDS) {
      expect(excluded.has(id)).toBe(false);
    }
  });
});
