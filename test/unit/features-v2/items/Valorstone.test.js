import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { Valorstone } from '../../../../src/features-v2/items/Valorstone.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, runReviewOutcome } from '../helpers.js';

describe('Items — Valorstone', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Valorstone', id: 'srd-itm-valorstone' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Valorstone',
        description: Valorstone.description,
        _source: 'item',
        _itemId: 'srd-itm-valorstone',
      })
    );
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Valorstone', id: 'srd-itm-valorstone' },
          { name: 'Valorstone', id: 'srd-itm-valorstone' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Valorstone').length).toBe(1);
  });

  it('on d6 6 when marking last armor slot: reduces pending HP loss by 1 and revokes armor commitment', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 1, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const action = {
      type: 'attack',
      actorInstanceId: 'adv-1',
      targetInstanceIds: ['char-1'],
      trait: 'Strength',
      range: 'melee',
      effects: [{ stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2 }],
      useArmorByTargetId: { 'char-1': true },
    };
    const { mutations } = runReviewOutcome(
      { ...Valorstone, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _rng: () => 0.999,
        action,
      }
    );
    expect(action.effects[0].amount).toBe(1);
    expect(action.useArmorByTargetId['char-1']).toBe(false);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd6', total: 6 }),
      })
    );
  });

  it('on d6 not 6: does not change HP or armor commitment', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 1, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2 }];
    runReviewOutcome(
      { ...Valorstone, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _rng: () => 0.4,
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Strength',
          range: 'melee',
          effects,
          useArmorByTargetId: { 'char-1': true },
        },
      }
    );
    expect(effects[0].amount).toBe(2);
  });
});
