import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { DripfangPoison } from '../../../../src/features-v2/consumables/DripfangPoison.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Consumables — Dripfang Poison', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Dripfang Poison', id: 'srd-cns-dripfang-poison' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Dripfang Poison',
        description: DripfangPoison.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-dripfang-poison',
      })
    );
  });

  it('onUse rolls 8d10 and queues actionLoop with the total for the creature who consumed it', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Dripfang Poison',
        _rng: () => 0,
      })
    );
    DripfangPoison.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({
          notation: '8d10',
          total: 8,
        }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Dripfang Poison',
          description: 'Apply 8 direct magic damage to the creature who consumed this poison.',
        }),
      })
    );
  });
});
