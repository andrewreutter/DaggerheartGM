/**
 * Regression tests for the canonical character ownership model introduced in
 * migrations/037_characters_table_id.sql + 038_characters_id_unique.sql.
 *
 * Core invariant: `upsertCharacterForTable` always writes exactly ONE row per
 * character id, regardless of which user calls it. Two different users writing
 * to the same id must produce a single updated row, not two shadow rows.
 *
 * `pg` is mocked so these run without a real Postgres connection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// pg mock — captured query calls for assertion
// ---------------------------------------------------------------------------
const queryMock = vi.fn();

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

const {
  getCharacterById,
  upsertCharacterForTable,
  deleteCharacterForTable,
  stampCharacterTableId,
  clearCharacterLibraryCacheForTests,
} = await import('../../src/db.js');

const APP_ID = 'test-app';
const TABLE_ID = 'table-t1';
const OTHER_TABLE_ID = 'table-t2';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Install a fake DB for the sequence of calls we expect.
 *
 * `getCharacterById` issues one SELECT; `upsertCharacterForTable` then issues
 * one UPDATE (existing row) or INSERT (no existing row).
 *
 * @param {object|null} existingRow  Simulated DB row for the SELECT, or null.
 * @param {{ rowCount?: number }}    updateResult  Simulated UPDATE result.
 */
function installFakeDb(existingRow, { rowCount = 1 } = {}) {
  queryMock.mockImplementation((sql) => {
    const normalized = sql.replace(/\s+/g, ' ').trim().toUpperCase();
    if (normalized.startsWith('SELECT')) {
      return Promise.resolve({ rows: existingRow ? [existingRow] : [] });
    }
    if (normalized.startsWith('UPDATE') || normalized.startsWith('INSERT')) {
      return Promise.resolve({ rowCount });
    }
    if (normalized.startsWith('DELETE')) {
      return Promise.resolve({ rowCount: 1 });
    }
    // stampCharacterTableId uses an UPDATE
    return Promise.resolve({ rowCount });
  });
}

function makeExistingRow(id, tableId = TABLE_ID, userId = 'gm-uid') {
  return {
    id,
    user_id: userId,
    table_id: tableId,
    is_public: false,
    updated_at: '2026-01-01T00:00:00Z',
    data: { name: `Character ${id}`, tier: 1 },
  };
}

beforeEach(() => {
  queryMock.mockReset();
  clearCharacterLibraryCacheForTests();
});

// ---------------------------------------------------------------------------
// getCharacterById
// ---------------------------------------------------------------------------

describe('getCharacterById', () => {
  it('returns null when no row exists', async () => {
    installFakeDb(null);
    const result = await getCharacterById(APP_ID, 'c-missing');
    expect(result).toBeNull();
  });

  it('returns the character merged with its data fields', async () => {
    installFakeDb(makeExistingRow('c1'));
    const result = await getCharacterById(APP_ID, 'c1');
    expect(result).not.toBeNull();
    expect(result.id).toBe('c1');
    expect(result.user_id).toBe('gm-uid');
    expect(result.table_id).toBe(TABLE_ID);
    expect(result.name).toBe('Character c1');
  });
});

// ---------------------------------------------------------------------------
// upsertCharacterForTable — the core ownership invariant
// ---------------------------------------------------------------------------

describe('upsertCharacterForTable', () => {
  it('inserts a new row when the character does not exist', async () => {
    installFakeDb(null);
    await upsertCharacterForTable(APP_ID, {
      requesterUid: 'gm-uid',
      tableId: TABLE_ID,
      id: 'c-new',
      data: { name: 'New Hero' },
    });
    const calls = queryMock.mock.calls;
    const insertCall = calls.find(([sql]) => sql.toUpperCase().includes('INSERT'));
    expect(insertCall).toBeDefined();
    // INSERT should stamp table_id = TABLE_ID
    expect(insertCall[1]).toContain(TABLE_ID);
    // INSERT should use the requesterUid as user_id
    expect(insertCall[1]).toContain('gm-uid');
  });

  it('updates the existing row in place regardless of which user calls it', async () => {
    // Existing row owned by GM uid
    installFakeDb(makeExistingRow('c-existing', TABLE_ID, 'gm-uid'));

    // A *player* uid writes to the same character id
    await upsertCharacterForTable(APP_ID, {
      requesterUid: 'player-uid',
      tableId: TABLE_ID,
      id: 'c-existing',
      data: { name: 'Updated Hero' },
    });

    const calls = queryMock.mock.calls;
    // Must use UPDATE, not INSERT (no shadow row)
    const updateCall = calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE'));
    expect(updateCall).toBeDefined();
    const insertCall = calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT'));
    expect(insertCall).toBeUndefined();
  });

  it('preserves the original user_id — the UPDATE does not touch user_id', async () => {
    installFakeDb(makeExistingRow('c-preserved', TABLE_ID, 'original-gm-uid'));

    await upsertCharacterForTable(APP_ID, {
      requesterUid: 'player-uid',
      tableId: TABLE_ID,
      id: 'c-preserved',
      data: { name: 'Still the Same Char' },
    });

    const calls = queryMock.mock.calls;
    const updateSql = calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE'))?.[0] ?? '';
    // The UPDATE must NOT include "user_id" in its SET clause
    expect(updateSql.toLowerCase()).not.toMatch(/set\s.*user_id/);
  });

  it('throws 409 when the existing row belongs to a different table', async () => {
    installFakeDb(makeExistingRow('c-conflict', OTHER_TABLE_ID, 'gm-uid'));

    await expect(
      upsertCharacterForTable(APP_ID, {
        requesterUid: 'attacker-uid',
        tableId: TABLE_ID,
        id: 'c-conflict',
        data: { name: 'Conflict' },
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('two sequential writes from different users both land in the single row', async () => {
    // First write: no row yet → INSERT
    installFakeDb(null);
    await upsertCharacterForTable(APP_ID, {
      requesterUid: 'gm-uid',
      tableId: TABLE_ID,
      id: 'c-double',
      data: { name: 'First Write' },
    });

    // Clear mocks; second write: row now exists → UPDATE
    queryMock.mockReset();
    clearCharacterLibraryCacheForTests();
    installFakeDb(makeExistingRow('c-double', TABLE_ID, 'gm-uid'));

    await upsertCharacterForTable(APP_ID, {
      requesterUid: 'player-uid',
      tableId: TABLE_ID,
      id: 'c-double',
      data: { name: 'Second Write' },
    });

    const calls = queryMock.mock.calls;
    const insertCalls = calls.filter(([sql]) => sql.toUpperCase().startsWith('INSERT'));
    const updateCalls = calls.filter(([sql]) => sql.toUpperCase().startsWith('UPDATE'));

    // Second write must UPDATE, not INSERT — only one canonical row
    expect(insertCalls).toHaveLength(0);
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// deleteCharacterForTable
// ---------------------------------------------------------------------------

describe('deleteCharacterForTable', () => {
  it('issues a DELETE with no user_id filter (unscoped)', async () => {
    installFakeDb(makeExistingRow('c-delete'));
    await deleteCharacterForTable(APP_ID, 'c-delete');
    const deleteCalls = queryMock.mock.calls.filter(([sql]) => sql.toUpperCase().startsWith('DELETE'));
    expect(deleteCalls).toHaveLength(1);
    const [sql, params] = deleteCalls[0];
    expect(sql.toLowerCase()).not.toContain('user_id');
    expect(params).toContain('c-delete');
  });
});

// ---------------------------------------------------------------------------
// stampCharacterTableId
// ---------------------------------------------------------------------------

describe('stampCharacterTableId', () => {
  it('returns true when the UPDATE touches a row', async () => {
    queryMock.mockResolvedValue({ rowCount: 1 });
    const result = await stampCharacterTableId(APP_ID, 'c-stamp', TABLE_ID);
    expect(result).toBe(true);
  });

  it('returns false when no row matched (e.g. table_id already set to a different value)', async () => {
    queryMock.mockResolvedValue({ rowCount: 0 });
    const result = await stampCharacterTableId(APP_ID, 'c-conflict', TABLE_ID);
    expect(result).toBe(false);
  });

  it('the UPDATE uses a conditional WHERE that rejects mismatched table_id', async () => {
    queryMock.mockResolvedValue({ rowCount: 0 });
    await stampCharacterTableId(APP_ID, 'c-any', TABLE_ID);
    const updateCall = queryMock.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('UPDATE'));
    expect(updateCall).toBeDefined();
    // WHERE clause must allow NULL or matching table_id only
    expect(updateCall[0].toLowerCase()).toMatch(/table_id\s+is\s+null\s+or/);
  });
});
