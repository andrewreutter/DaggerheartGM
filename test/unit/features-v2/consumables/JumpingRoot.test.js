import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { JumpingRoot } from '../../../../src/features-v2/consumables/JumpingRoot.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Consumables — Jumping Root', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Jumping Root', id: 'srd-cns-jumping-root' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Jumping Root',
        description: JumpingRoot.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-jumping-root',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Jumping Root' }],
      }),
      registry
    );
    expect(
      feats.some((f) => f.name === 'Jumping Root' && f._source === 'consumable')
    ).toBe(true);
  });

  it('onUse queues move (Far-range leap) and actionLoop when token is on the map', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Jumping Root',
    });
    const table = buildTableSnapshot(gs);
    JumpingRoot.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          description: expect.stringContaining('Jumping Root'),
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Jumping Root',
        }),
      })
    );
  });

  it('move predicate allows landings within Far (≤100 ft) and rejects farther', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const base = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Jumping Root',
    });
    const table = buildTableSnapshot(base);
    JumpingRoot.onUse(table);
    const mutations = applyMutations(table);
    const moveMut = mutations.find((m) => m.type === 'move');
    const fn = moveMut.payload.conditionFn;

    const okChar = mockCharacter({ instanceId: 'char-1', tokenX: 60, tokenY: 0 });
    const tblOk = buildTableSnapshot({
      ...base,
      activeElements: [okChar],
    });
    expect(fn(tblOk)).toBe(true);

    const tooFar = mockCharacter({ instanceId: 'char-1', tokenX: 150, tokenY: 0 });
    const tblBad = buildTableSnapshot({
      ...base,
      activeElements: [tooFar],
    });
    expect(fn(tblBad)).toBe(false);
  });
});
