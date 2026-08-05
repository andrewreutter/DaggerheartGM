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

/** Simulates the character-resolution fetch: params = [appId, ids]. */
function makeLibRow(id, overrides = {}) {
  const { user_id = 'owner-uid', updated_at = '2026-01-01T00:00:00Z', ...dataOverrides } = overrides;
  return { id, user_id, is_public: false, updated_at, data: { name: `Character ${id}`, tier: 1, ...dataOverrides } };
}

/** rowsById values may be a single row or an array of rows (duplicate id across users). */
function installQueryImpl(rowsById) {
  queryMock.mockImplementation((sql, params) => {
    const ids = params[1];
    const rows = ids
      .filter((id) => rowsById.has(id))
      .flatMap((id) => [].concat(rowsById.get(id)));
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
    expect(params[1]).toEqual(['c1']); // only the invalidated id was re-fetched, not c2
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

  it('resolves the most recently updated row when the same character id exists under multiple users', async () => {
    // Regression: items PK is (app_id, user_id, collection, id), so a GM and a player who both
    // synced the same Daggerstack character hold rows with the SAME id. The player's stale,
    // imageless copy must not shadow the GM's freshly edited row (production bug: portraits
    // vanished on every table_state re-push, e.g. after a map pan).
    const rowsById = new Map([
      ['c1', [
        makeLibRow('c1', { user_id: 'gm-uid', updated_at: '2026-08-05T13:00:00Z', name: 'Vodalus', imageUrl: 'https://storage.example/vodalus.png' }),
        makeLibRow('c1', { user_id: 'player-uid', updated_at: '2026-07-07T00:00:00Z', name: 'Vodalus' }),
      ]],
    ]);
    installQueryImpl(rowsById);

    const resolved = await resolveCharacterElements(APP_ID, [{ elementType: 'character', id: 'c1', instanceId: 'i1' }]);
    expect(resolved[0].imageUrl).toBe('https://storage.example/vodalus.png');

    // Row order from Postgres is arbitrary heap order — reversed order must give the same pick.
    clearCharacterLibraryCacheForTests();
    rowsById.set('c1', [...rowsById.get('c1')].reverse());
    const resolvedReversed = await resolveCharacterElements(APP_ID, [{ elementType: 'character', id: 'c1', instanceId: 'i1' }]);
    expect(resolvedReversed[0].imageUrl).toBe('https://storage.example/vodalus.png');
  });

  it('breaks updated_at ties deterministically regardless of row order', async () => {
    const sameTs = '2026-08-05T13:00:00Z';
    const rowA = makeLibRow('c1', { user_id: 'a-uid', updated_at: sameTs, name: 'From A' });
    const rowB = makeLibRow('c1', { user_id: 'b-uid', updated_at: sameTs, name: 'From B' });

    installQueryImpl(new Map([['c1', [rowA, rowB]]]));
    const r1 = await resolveCharacterElements(APP_ID, [{ elementType: 'character', id: 'c1', instanceId: 'i1' }]);

    clearCharacterLibraryCacheForTests();
    installQueryImpl(new Map([['c1', [rowB, rowA]]]));
    const r2 = await resolveCharacterElements(APP_ID, [{ elementType: 'character', id: 'c1', instanceId: 'i1' }]);

    expect(r1[0].name).toBe(r2[0].name); // same winner either way
  });

  it('returns elements unchanged (no query) when there are no character elements', async () => {
    const elements = [{ elementType: 'adversary', id: 'adv1', instanceId: 'i1' }];
    const resolved = await resolveCharacterElements(APP_ID, elements);
    expect(queryMock).not.toHaveBeenCalled();
    expect(resolved).toBe(elements);
  });
});
