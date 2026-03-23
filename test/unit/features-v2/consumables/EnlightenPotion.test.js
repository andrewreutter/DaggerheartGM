import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { EnlightenPotion } from '../../../../src/features-v2/consumables/EnlightenPotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Enlighten Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Enlighten Potion', id: 'srd-cns-enlighten-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Enlighten Potion',
        description: EnlightenPotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-enlighten-potion',
      })
    );
  });

  it('dedupes the same consumable id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Enlighten Potion', id: 'srd-cns-enlighten-potion' },
          { name: 'Enlighten Potion', id: 'srd-cns-enlighten-potion' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Enlighten Potion').length).toBe(1);
  });

  it('onUse queues appendActiveModifier', () => {
    const t = buildTableSnapshot(
      mockGameState({ _ownerInstanceId: 'char-1', _featureKey: 'Enlighten Potion' })
    );
    EnlightenPotion.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'appendActiveModifier',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          modifier: expect.objectContaining({
            id: 'cns-enlighten-potion-next-knowledge',
            name: 'Enlighten Potion',
          }),
        }),
      })
    );
  });

  it('onIntent applies +1 to action roll and removes pending modifier on Knowledge rolls', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      activeModifiers: [{ id: 'cns-enlighten-potion-next-knowledge', name: 'Enlighten Potion' }],
    });
    const { mutations } = runIntent(
      { ...EnlightenPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Knowledge' },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Enlighten Potion',
          value: 1,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeActiveModifier',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          id: 'cns-enlighten-potion-next-knowledge',
        }),
      })
    );
  });

  it('onIntent does nothing when trait is not Knowledge', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      activeModifiers: [{ id: 'cns-enlighten-potion-next-knowledge', name: 'Enlighten Potion' }],
    });
    const { mutations } = runIntent(
      { ...EnlightenPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
    expect(mutations.filter((m) => m.type === 'removeActiveModifier')).toHaveLength(0);
  });
});
