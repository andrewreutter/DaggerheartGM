import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { BridgeSeed } from '../../../../src/features-v2/consumables/BridgeSeed.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Consumables — Bridge Seed', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Bridge Seed', id: 'srd-cns-bridge-seed' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Bridge Seed',
        description: BridgeSeed.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-bridge-seed',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Bridge Seed' }],
      }),
      registry
    );
    expect(
      feats.some((f) => f.name === 'Bridge Seed' && f._source === 'consumable')
    ).toBe(true);
  });

  it('onUse queues move (Far-range climb) and actionLoop when token is on the map', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bridge Seed',
    });
    const table = buildTableSnapshot(gs);
    BridgeSeed.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          description: expect.stringContaining('Bridge Seed'),
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Bridge Seed',
        }),
      })
    );
  });

  it('move predicate allows landings within Far (≤100 ft) and rejects farther', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const base = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bridge Seed',
    });
    const table = buildTableSnapshot(base);
    BridgeSeed.onUse(table);
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
