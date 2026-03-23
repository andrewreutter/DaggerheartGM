import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { Greatstone } from '../../../../src/features-v2/items/Greatstone.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, runReviewAction, mockRoll, mockAction } from '../helpers.js';

describe('Items — Greatstone', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Greatstone', id: 'srd-itm-greatstone' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Greatstone',
        description: Greatstone.description,
        _source: 'item',
        _itemId: 'srd-itm-greatstone',
      })
    );
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Greatstone', id: 'srd-itm-greatstone' },
          { name: 'Greatstone', id: 'srd-itm-greatstone' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Greatstone').length).toBe(1);
  });

  it('delegates Powerful: successful attack rolls extra weapon die and keeps higher', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 4, damageType: 'physical', source: char }];
    const { mutations } = runReviewAction({ ...Greatstone, _ownerInstanceId: 'char-1' }, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack' }),
        effects,
      },
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 4 }],
      }),
      _rng: () => 6 / 8,
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rollDie', payload: expect.objectContaining({ notation: 'd8' }) })
    );
    expect(effects[0].amount).toBe(4 + (7 - 4));
  });
});
