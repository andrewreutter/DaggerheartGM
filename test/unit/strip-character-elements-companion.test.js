/**
 * Regression test: `stripCharacterElementsForDb` (src/db.js) must keep a character's `companion`
 * field (Beastbound Ranger companion — name, species, evasion, maxStress, currentStress) when
 * stripping a character element down to persisted keys before the DB write.
 *
 * Bug: `CHARACTER_RUNTIME_KEYS_DB` in src/db.js is a manually-maintained mirror of
 * `CHARACTER_RUNTIME_KEYS` in src/client/lib/table-ops.js and had drifted out of sync — it was
 * missing `'companion'`. Every `update-element` op that changed `companion.currentStress` was
 * applied in memory, then silently stripped by `stripCharacterElementsForDb` right before the DB
 * write, so the change never persisted. The next resolved table_state snapshot
 * (`resolveCharacterElements`) then re-derived `companion` from the library row with
 * `currentStress: el.companion?.currentStress` — which was now `undefined` — wiping the edit with
 * no error anywhere (client-side `postTableOp` also doesn't surface HTTP errors, so this failed
 * completely silently).
 *
 * `pg` is mocked so this runs without a real Postgres connection.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('pg', () => {
  return {
    default: {
      Pool: class {
        // eslint-disable-next-line class-methods-use-this
        query() {
          return Promise.resolve({ rows: [] });
        }
      },
    },
  };
});

const { stripCharacterElementsForDb } = await import('../../src/db.js');

describe('stripCharacterElementsForDb', () => {
  it('preserves the companion field (Beastbound Ranger) on character elements', () => {
    const elements = [
      {
        instanceId: 'char-1',
        elementType: 'character',
        id: 'lib-char-1',
        name: 'Rowan',
        currentHp: 5,
        currentStress: 1,
        companion: {
          name: 'Fang',
          species: 'Wolf',
          evasion: 12,
          maxStress: 3,
          currentStress: 2,
        },
      },
    ];

    const [stripped] = stripCharacterElementsForDb(elements);

    expect(stripped.companion).toBeDefined();
    expect(stripped.companion).toEqual({
      name: 'Fang',
      species: 'Wolf',
      evasion: 12,
      maxStress: 3,
      currentStress: 2,
    });
  });

  it('preserves gold and inventory runtime fields on character elements', () => {
    const elements = [
      {
        instanceId: 'char-1',
        elementType: 'character',
        id: 'lib-char-1',
        name: 'Rowan',
        gold: 465,
        inventory: [{ uid: 'inv-1', name: 'Rope', quantity: 1 }],
      },
    ];
    const [stripped] = stripCharacterElementsForDb(elements);
    expect(stripped.gold).toBe(465);
    expect(stripped.inventory).toEqual([{ uid: 'inv-1', name: 'Rope', quantity: 1 }]);
  });

  it('leaves non-character elements untouched', () => {
    const elements = [{ instanceId: 'adv-1', elementType: 'adversary', name: 'Goblin' }];
    const [result] = stripCharacterElementsForDb(elements);
    expect(result).toBe(elements[0]);
  });
});
