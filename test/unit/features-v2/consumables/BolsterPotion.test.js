import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { BolsterPotion } from '../../../../src/features-v2/consumables/BolsterPotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Bolster Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Bolster Potion', id: 'srd-cns-bolster-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Bolster Potion',
        description: BolsterPotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-bolster-potion',
      })
    );
  });

  it('dedupes the same consumable id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Bolster Potion', id: 'srd-cns-bolster-potion' },
          { name: 'Bolster Potion', id: 'srd-cns-bolster-potion' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Bolster Potion').length).toBe(1);
  });

  it('onUse queues appendActiveModifier', () => {
    const t = buildTableSnapshot(
      mockGameState({ _ownerInstanceId: 'char-1', _featureKey: 'Bolster Potion' })
    );
    BolsterPotion.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'appendActiveModifier',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          modifier: expect.objectContaining({
            id: 'cns-bolster-potion-next-strength',
            name: 'Bolster Potion',
          }),
        }),
      })
    );
  });

  it('onIntent applies +1 to action roll and removes pending modifier on Strength rolls', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      activeModifiers: [{ id: 'cns-bolster-potion-next-strength', name: 'Bolster Potion' }],
    });
    const { mutations } = runIntent(
      { ...BolsterPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Strength' },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Bolster Potion',
          value: 1,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeActiveModifier',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          id: 'cns-bolster-potion-next-strength',
        }),
      })
    );
  });

  it('onIntent does nothing when trait is not Strength', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      activeModifiers: [{ id: 'cns-bolster-potion-next-strength', name: 'Bolster Potion' }],
    });
    const { mutations } = runIntent(
      { ...BolsterPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
    expect(mutations.filter((m) => m.type === 'removeActiveModifier')).toHaveLength(0);
  });
});
