import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { MajorStaminaPotion } from '../../../../src/features-v2/consumables/MajorStaminaPotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Major Stamina Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Major Stamina Potion', id: 'srd-cns-major-stamina-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Major Stamina Potion',
        description: MajorStaminaPotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-major-stamina-potion',
      })
    );
  });

  it('onUse queues rollDie then clearStress for 1d4+2', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Major Stamina Potion',
        _rng: () => 0.625,
      })
    );
    MajorStaminaPotion.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({
          notation: 'd4',
          total: 3,
        }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          amount: 5,
        }),
      })
    );
  });

  it('onIntent does not queue stress clear (card action is onUse only)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const { mutations } = runIntent(
      { ...MajorStaminaPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
      }
    );
    expect(mutations.filter((m) => m.type === 'clearStress')).toHaveLength(0);
    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
  });
});
