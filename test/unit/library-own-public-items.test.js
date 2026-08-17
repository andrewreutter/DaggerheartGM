/**
 * Own public library rows (e.g. a scene with Make Public) must appear under Mine and
 * under Public, with `_source: 'own'`. All / Mine+Public uses one items SELECT so
 * totals do not double-count. `pg` is mocked — no live DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const { getUnifiedItems } = await import('../../src/db.js');

const APP_ID = 'test-app';
const USER_ID = 'user-1';

const OWN_PUBLIC_SCENE = {
  id: 'my-public-scene',
  data: { name: 'My Public Scene', tier: 1 },
  user_id: USER_ID,
  is_public: true,
  cc: 0,
  pc: 0,
  _source: 'own',
};

function itemsSqlCalls() {
  return calls.filter(({ sql }) => /FROM items i/i.test(sql));
}

function installQueryImpl({ rows = [] } = {}) {
  queryMock.mockImplementation((sql, params = []) => {
    calls.push({ sql, params });
    if (/^SELECT COUNT\(\*\) AS cnt\b/i.test(String(sql).trim())) {
      return Promise.resolve({ rows: [{ cnt: String(rows.length) }] });
    }
    return Promise.resolve({ rows });
  });
}

beforeEach(() => {
  queryMock.mockReset();
  calls.length = 0;
});

describe('getUnifiedItems own public rows', () => {
  it('Mine includes the viewer’s public items via user_id (no is_public=false gate)', async () => {
    installQueryImpl({ rows: [OWN_PUBLIC_SCENE] });

    const result = await getUnifiedItems(APP_ID, USER_ID, 'scenes', {
      includeMine: true,
      includePublic: false,
      includeSrd: false,
      search: '',
      sort: 'name',
      offset: 0,
      limit: 20,
    });

    const itemSql = itemsSqlCalls();
    expect(itemSql).toHaveLength(2);
    expect(itemSql[0].sql).toMatch(/i\.user_id = \$1/);
    expect(itemSql[0].sql).not.toMatch(/i\.is_public = false/);
    expect(itemSql[0].params).toContain(USER_ID);
    expect(result.items).toEqual([
      expect.objectContaining({ id: 'my-public-scene', _source: 'own', is_public: true }),
    ]);
  });

  it('Public includes the viewer’s own public items and labels them own', async () => {
    installQueryImpl({ rows: [OWN_PUBLIC_SCENE] });

    const result = await getUnifiedItems(APP_ID, USER_ID, 'scenes', {
      includeMine: false,
      includePublic: true,
      includeSrd: false,
      search: '',
      sort: 'name',
      offset: 0,
      limit: 20,
    });

    const itemSql = itemsSqlCalls();
    expect(itemSql).toHaveLength(2);
    expect(itemSql[0].sql).toMatch(/i\.is_public = true/);
    expect(itemSql[0].sql).not.toMatch(/i\.user_id != \$/);
    expect(itemSql[0].sql).toMatch(/CASE WHEN i\.user_id = \$1 THEN 'own'/);
    expect(itemSql[0].params[0]).toBe(USER_ID);
    expect(result.items[0]._source).toBe('own');
    expect(result.totalCount).toBe(1);
  });

  it('Mine+Public uses one items branch (OR) so an own public row is not counted twice', async () => {
    installQueryImpl({ rows: [OWN_PUBLIC_SCENE] });

    const result = await getUnifiedItems(APP_ID, USER_ID, 'scenes', {
      includeMine: true,
      includePublic: true,
      includeSrd: false,
      search: '',
      sort: 'name',
      offset: 0,
      limit: 20,
    });

    const itemSql = itemsSqlCalls();
    expect(itemSql).toHaveLength(2);
    expect(itemSql[0].sql).toMatch(/i\.user_id = \$1/);
    expect(itemSql[0].sql).toMatch(/i\.is_public = true/);
    expect(itemSql[0].sql).toMatch(/ OR /);
    expect(itemSql[0].sql.match(/FROM items i/gi)).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.items).toHaveLength(1);
  });
});
