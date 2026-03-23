import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { collectChips } from '../../../../src/features-v2/engine/chip-system.js';
import { GrowingPotion } from '../../../../src/features-v2/consumables/GrowingPotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Growing Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Growing Potion', id: 'srd-cns-growing-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Growing Potion',
        description: GrowingPotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-growing-potion',
      })
    );
  });

  it('drink chip queues setFeatureState to enlarge', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: char.instanceId,
      _featureKey: 'Growing Potion',
    });
    const table = buildTableSnapshot(gs);
    const feat = { ...GrowingPotion, _ownerInstanceId: char.instanceId };
    const chips = collectChips([feat], 'card', table);
    const drink = chips.find((c) => c.name === 'Growing Potion');
    expect(drink).toBeDefined();
    drink.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Growing Potion',
          key: 'growingPotionEnlarged',
          value: true,
        }),
      })
    );
  });

  it('passiveStatMods adds +2 Strength and +1 Proficiency while enlarged', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-cns-growing-potion', name: 'Growing Potion' }],
      proficiency: 1,
      featureState: {
        'Growing Potion': { growingPotionEnlarged: true },
      },
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.stats.strength).toBe(3);
    expect(decl.stats.proficiency).toBe(2);
  });

  it('drop chip clears enlarged state', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: char.instanceId,
      _featureKey: 'Growing Potion',
      featureState: {
        'Growing Potion': { growingPotionEnlarged: true },
      },
    });
    const table = buildTableSnapshot(gs);
    const feat = { ...GrowingPotion, _ownerInstanceId: char.instanceId };
    const chips = collectChips([feat], 'card', table);
    const drop = chips.find((c) => c.name === 'Drop enlarged form');
    expect(drop).toBeDefined();
    drop.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Growing Potion',
          key: 'growingPotionEnlarged',
          value: false,
        }),
      })
    );
  });

  it('onRest (short rest) clears enlarged state', () => {
    const { mutations } = runIntent(
      { ...GrowingPotion, _ownerInstanceId: 'char-1' },
      {
        actionType: 'shortRest',
        featureState: {
          'Growing Potion': { growingPotionEnlarged: true },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Growing Potion',
          key: 'growingPotionEnlarged',
          value: false,
        }),
      })
    );
  });

  it('onRest (long rest) clears enlarged state', () => {
    const { mutations } = runIntent(
      { ...GrowingPotion, _ownerInstanceId: 'char-1' },
      {
        actionType: 'longRest',
        featureState: {
          'Growing Potion': { growingPotionEnlarged: true },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Growing Potion',
          key: 'growingPotionEnlarged',
          value: false,
        }),
      })
    );
  });
});
