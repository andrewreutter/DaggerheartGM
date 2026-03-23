import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { Bloodstone } from '../../../../src/features-v2/items/Bloodstone.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, runReviewAction, mockRoll, mockAction } from '../helpers.js';

describe('Items — Bloodstone', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Bloodstone', id: 'srd-itm-bloodstone' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Bloodstone',
        description: Bloodstone.description,
        _source: 'item',
        _itemId: 'srd-itm-bloodstone',
      })
    );
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Bloodstone', id: 'srd-itm-bloodstone' },
          { name: 'Bloodstone', id: 'srd-itm-bloodstone' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Bloodstone').length).toBe(1);
  });

  it('delegates Brutal: max damage die face queues extra die and increases damage', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 8, damageType: 'physical', source: char }];
    const { mutations } = runReviewAction({ ...Bloodstone, _ownerInstanceId: 'char-1' }, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack' }),
        effects,
      },
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 8 }] }),
      _rng: () => 4 / 8,
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rollDie', payload: expect.objectContaining({ notation: 'd8' }) })
    );
    expect(effects[0].amount).toBe(13);
  });
});
