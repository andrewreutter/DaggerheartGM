/**
 * Unit tests for the in-memory character library cache used by `resolveCharacterElements`
 * (src/db.js). Verifies the Phase 2 perf fix: table_state resolution should not re-query the
 * `characters` library on every op once a character's row has been fetched, and must be
 * precisely invalidated on write so it can never serve stale data after a character save.
 *
 * `pg` is mocked so these run without a real Postgres connection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('pg', () => {
  return {
    default: {
      Pool: class {
        // eslint-disable-next-line class-methods-use-this
        query(...args) {
          return queryMock(...args);
        }
      },
    },
  };
});

const { resolveCharacterElements, invalidateCharacterLibraryCache, clearCharacterLibraryCacheForTests } =
  await import('../../src/db.js');

const APP_ID = 'test-app';

/** Simulates the `getItemsByIds` query: params = [appId, collection, ids]. */
function makeLibRow(id, overrides = {}) {
  return { id, user_id: 'owner-uid', is_public: false, data: { name: `Character ${id}`, tier: 1, ...overrides } };
}

function installQueryImpl(rowsById) {
  queryMock.mockImplementation((sql, params) => {
    const ids = params[2];
    const rows = ids.filter((id) => rowsById.has(id)).map((id) => rowsById.get(id));
    return Promise.resolve({ rows });
  });
}

beforeEach(() => {
  queryMock.mockReset();
  clearCharacterLibraryCacheForTests();
});

describe('resolveCharacterElements character library cache', () => {
  it('queries the DB once per character id, then serves subsequent resolves from cache', async () => {
    const rowsById = new Map([
      ['c1', makeLibRow('c1')],
      ['c2', makeLibRow('c2')],
    ]);
    installQueryImpl(rowsById);

    const elements = [
      { elementType: 'character', id: 'c1', instanceId: 'i1', currentHp: 5 },
      { elementType: 'character', id: 'c2', instanceId: 'i2', currentHp: 3 },
      { elementType: 'adversary', id: 'adv1', instanceId: 'i3' },
    ];

    const resolved1 = await resolveCharacterElements(APP_ID, elements);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(resolved1.find((e) => e.instanceId === 'i1').name).toBe('Character c1');
    expect(resolved1.find((e) => e.instanceId === 'i1').currentHp).toBe(5); // runtime field preserved
    expect(resolved1.find((e) => e.instanceId === 'i3')).toEqual(elements[2]); // non-character untouched

    // Simulate an unrelated op (adversary token drag) triggering another resolve of the same characters.
    const resolved2 = await resolveCharacterElements(APP_ID, elements);
    expect(queryMock).toHaveBeenCalledTimes(1); // still 1 — served from cache, no new DB round trip
    expect(resolved2.find((e) => e.instanceId === 'i2').name).toBe('Character c2');
  });

  it('does not request popularity columns (clone_count/play_count) for the character resolution hot path', async () => {
    const rowsById = new Map([['c1', makeLibRow('c1')]]);
    installQueryImpl(rowsById);

    await resolveCharacterElements(APP_ID, [{ elementType: 'character', id: 'c1', instanceId: 'i1' }]);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql] = queryMock.mock.calls[0];
    expect(sql).not.toMatch(/item_popularity/);
  });

  it('re-queries only the invalidated character after a save, leaving other cached characters untouched', async () => {
    const rowsById = new Map([
      ['c1', makeLibRow('c1')],
      ['c2', makeLibRow('c2')],
    ]);
    installQueryImpl(rowsById);

    const elements = [
      { elementType: 'character', id: 'c1', instanceId: 'i1' },
      { elementType: 'character', id: 'c2', instanceId: 'i2' },
    ];

    await resolveCharacterElements(APP_ID, elements);
    expect(queryMock).toHaveBeenCalledTimes(1);

    // Character c1 is saved/edited in the Library — invalidate just that id.
    rowsById.set('c1', makeLibRow('c1', { name: 'Character c1 (renamed)' }));
    invalidateCharacterLibraryCache(APP_ID, 'c1');

    const resolved = await resolveCharacterElements(APP_ID, elements);
    expect(queryMock).toHaveBeenCalledTimes(2);
    const [, params] = queryMock.mock.calls[1];
    expect(params[2]).toEqual(['c1']); // only the invalidated id was re-fetched, not c2
    expect(resolved.find((e) => e.instanceId === 'i1').name).toBe('Character c1 (renamed)');
    expect(resolved.find((e) => e.instanceId === 'i2').name).toBe('Character c2'); // unaffected
  });

  it('keys the cache per appId so identical character ids on different apps do not collide', async () => {
    const rowsById = new Map([['c1', makeLibRow('c1', { name: 'App A char' })]]);
    installQueryImpl(rowsById);
    await resolveCharacterElements('app-a', [{ elementType: 'character', id: 'c1', instanceId: 'i1' }]);
    expect(queryMock).toHaveBeenCalledTimes(1);

    rowsById.set('c1', makeLibRow('c1', { name: 'App B char' }));
    const resolvedB = await resolveCharacterElements('app-b', [{ elementType: 'character', id: 'c1', instanceId: 'i1' }]);
    expect(queryMock).toHaveBeenCalledTimes(2); // different app — cache miss, fresh query
    expect(resolvedB[0].name).toBe('App B char');
  });

  it('returns elements unchanged (no query) when there are no character elements', async () => {
    const elements = [{ elementType: 'adversary', id: 'adv1', instanceId: 'i1' }];
    const resolved = await resolveCharacterElements(APP_ID, elements);
    expect(queryMock).not.toHaveBeenCalled();
    expect(resolved).toBe(elements);
  });
});
