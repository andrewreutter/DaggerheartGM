/**
 * Starter scenes live in `external_item_cache` (source='dt', collection='scenes').
 * `getUnifiedItems` must union that cache when includeSrd is on; Library All's scenes
 * branch must pass includeSrd through. Other collections still query source='srd'.
 * `pg` is mocked — no live DB or seed script.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { COLLECTION_NAMES as SRD_COLLECTION_NAMES } from '../../src/srd/parser.js';

const queryMock = vi.fn();
const calls = [];

vi.mock('pg', () => ({
  default: {
    Pool: class {
      // eslint-disable-next-line class-methods-use-this
      query(...args) {
        return queryMock(...args);
      }
    },
  },
}));

const { getUnifiedItems, getUnifiedLibraryAll, getUnifiedLibraryAllBranchCounts } = await import('../../src/db.js');

const APP_ID = 'test-app';
const USER_ID = 'user-1';

const DT_SCENE_ROW = {
  id: 'srd-scene-abandoned-grove',
  data: { name: 'Abandoned Grove', tier: 1, _source: 'dt' },
  user_id: null,
  is_public: false,
  cc: 0,
  pc: 0,
  _source: 'dt',
};

const OWN_SCENE_ROW = {
  id: 'my-scene',
  data: { name: 'My Homebrew Scene', tier: 2 },
  user_id: USER_ID,
  is_public: false,
  cc: 0,
  pc: 0,
  _source: 'own',
};

function isScenesQuery(params) {
  return Array.isArray(params) && params.includes('scenes');
}

function sqlQueriesExtCacheSource(sql, params, collection, source) {
  return /external_item_cache/i.test(sql)
    && Array.isArray(params)
    && params.includes(collection)
    && params.some((p) => Array.isArray(p) && p.includes(source));
}

function sqlQueriesDtSceneCache(sql, params) {
  return sqlQueriesExtCacheSource(sql, params, 'scenes', 'dt')
    && !params.some((p) => Array.isArray(p) && p.includes('srd'));
}

function installQueryImpl({ sceneRows = [] } = {}) {
  queryMock.mockImplementation((sql, params = []) => {
    calls.push({ sql, params });
    const scenes = isScenesQuery(params);
    // Outer count only — union parts also embed `SELECT COUNT(*)` popularity subqueries.
    if (/^SELECT COUNT\(\*\) AS cnt\b/i.test(String(sql).trim())) {
      return Promise.resolve({ rows: [{ cnt: String(scenes ? sceneRows.length : 0) }] });
    }
    return Promise.resolve({ rows: scenes ? sceneRows : [] });
  });
}

beforeEach(() => {
  queryMock.mockReset();
  calls.length = 0;
});

describe('getUnifiedItems scenes + external_item_cache', () => {
  it('includeSrd=true queries the cache and returns seeded DT scenes', async () => {
    installQueryImpl({ sceneRows: [DT_SCENE_ROW] });

    const result = await getUnifiedItems(APP_ID, USER_ID, 'scenes', {
      includeMine: false,
      includePublic: false,
      includeSrd: true,
      search: '',
      sort: 'name',
      offset: 0,
      limit: 20,
    });

    expect(calls.some(({ sql, params }) => sqlQueriesDtSceneCache(sql, params))).toBe(true);
    expect(result.totalCount).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('srd-scene-abandoned-grove');
    expect(result.items[0].name).toBe('Abandoned Grove');
    expect(result.items[0]._source).toBe('dt');
  });

  it('includeSrd=true still queries source srd for non-scene collections', async () => {
    installQueryImpl();

    await getUnifiedItems(APP_ID, USER_ID, 'adversaries', {
      includeMine: false,
      includePublic: false,
      includeSrd: true,
      search: '',
      sort: 'name',
      offset: 0,
      limit: 20,
    });

    expect(calls.some(({ sql, params }) => sqlQueriesExtCacheSource(sql, params, 'adversaries', 'srd'))).toBe(true);
    expect(calls.some(({ sql, params }) => sqlQueriesExtCacheSource(sql, params, 'adversaries', 'dt'))).toBe(false);
  });

  it('includeSrd=false does not query external_item_cache for scenes', async () => {
    installQueryImpl({ sceneRows: [OWN_SCENE_ROW] });

    const result = await getUnifiedItems(APP_ID, USER_ID, 'scenes', {
      includeMine: true,
      includePublic: false,
      includeSrd: false,
      search: '',
      sort: 'name',
      offset: 0,
      limit: 20,
    });

    expect(calls.some(({ sql }) => /external_item_cache/i.test(sql))).toBe(false);
    expect(result.items.every((item) => item._source !== 'srd' && item._source !== 'dt')).toBe(true);
    expect(result.items.some((item) => item.id === 'srd-scene-abandoned-grove')).toBe(false);
  });

  it('merges own items with DT cache rows when both sources are on', async () => {
    installQueryImpl({ sceneRows: [OWN_SCENE_ROW, DT_SCENE_ROW] });

    const result = await getUnifiedItems(APP_ID, USER_ID, 'scenes', {
      includeMine: true,
      includePublic: false,
      includeSrd: true,
      search: '',
      sort: 'name',
      offset: 0,
      limit: 20,
    });

    expect(calls.some(({ sql, params }) => sqlQueriesDtSceneCache(sql, params))).toBe(true);
    expect(calls.some(({ sql }) => /FROM items/i.test(sql))).toBe(true);
    expect(result.items.map((i) => i.id).sort()).toEqual(['my-scene', 'srd-scene-abandoned-grove']);
  });
});

describe('Library All scenes branch', () => {
  const baseOpts = {
    includeMine: true,
    includePublic: false,
    search: '',
    sort: 'name',
    offset: 0,
    limit: 20,
    tiers: [],
    levels: [],
    advRole: [],
    envType: [],
    ablDomain: [],
    wpnSlot: [],
    wpnPhyMag: [],
    featScope: [],
    includeScaledUp: false,
  };

  it('includeSrd=true includes the scenes cache query', async () => {
    installQueryImpl({ sceneRows: [DT_SCENE_ROW] });

    const result = await getUnifiedLibraryAll(APP_ID, USER_ID, {
      ...baseOpts,
      includeSrd: true,
      search: 'Abandoned Grove',
      limit: 50,
    });

    expect(calls.some(({ sql, params }) => sqlQueriesDtSceneCache(sql, params))).toBe(true);
    expect(result.countsByCollection.scenes).toBe(1);
    expect(result.items.filter((i) => i._collection === 'scenes')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'srd-scene-abandoned-grove',
          _source: 'dt',
          _collection: 'scenes',
        }),
      ])
    );
  });

  it('includeSrd=false does not query the scenes cache', async () => {
    installQueryImpl({ sceneRows: [OWN_SCENE_ROW] });

    await getUnifiedLibraryAll(APP_ID, USER_ID, { ...baseOpts, includeSrd: false });

    expect(calls.some(({ sql, params }) => sqlQueriesDtSceneCache(sql, params))).toBe(false);
    expect(calls.filter(({ sql, params }) => /external_item_cache/i.test(sql) && isScenesQuery(params))).toHaveLength(0);
  });

  it('counts scenes once (not via SRD_COLLECTION_NAMES and the scenes branch)', async () => {
    expect(SRD_COLLECTION_NAMES).not.toContain('scenes');
    installQueryImpl({ sceneRows: [DT_SCENE_ROW, OWN_SCENE_ROW] });

    const counts = await getUnifiedLibraryAllBranchCounts(APP_ID, USER_ID, {
      ...baseOpts,
      includeSrd: true,
    });

    expect(counts.countsByCollection.scenes).toBe(2);
    expect(Object.keys(counts.countsByCollection).filter((k) => k === 'scenes')).toHaveLength(1);
  });
});

describe('GET /api/data/scenes unified path', () => {
  it('includes scenes in UNIFIED_COLLECTIONS so includeSrd uses getUnifiedItems', () => {
    const serverSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../server.js'), 'utf8');
    expect(serverSrc).toMatch(/UNIFIED_COLLECTIONS\s*=\s*\[\s*\.\.\.SRD_COLLECTION_NAMES\s*,\s*['"]scenes['"]\s*\]/);
  });
});
