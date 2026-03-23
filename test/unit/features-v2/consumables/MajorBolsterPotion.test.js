import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { MajorBolsterPotion } from '../../../../src/features-v2/consumables/MajorBolsterPotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Major Bolster Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Major Bolster Potion', id: 'srd-cns-major-bolster-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Major Bolster Potion',
        description: MajorBolsterPotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-major-bolster-potion',
      })
    );
  });

  it('onUse queues setFeatureState to activate Strength bonus', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: char.instanceId,
      _featureKey: 'Major Bolster Potion',
    });
    const table = buildTableSnapshot(gs);
    MajorBolsterPotion.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Bolster Potion',
          key: 'majorBolsterActive',
          value: true,
        }),
      })
    );
  });

  it('passiveStatMods adds +1 Strength while active in featureState', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-cns-major-bolster-potion', name: 'Major Bolster Potion' }],
      featureState: {
        'Major Bolster Potion': { majorBolsterActive: true },
      },
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.stats.strength).toBe(2);
  });

  it('does not add Strength when the potion effect is inactive', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-cns-major-bolster-potion', name: 'Major Bolster Potion' }],
      featureState: {
        'Major Bolster Potion': { majorBolsterActive: false },
      },
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.stats.strength).toBe(1);
  });

  it('onRest (short rest) clears the buff flag', () => {
    const { mutations } = runIntent(
      { ...MajorBolsterPotion, _ownerInstanceId: 'char-1' },
      {
        actionType: 'shortRest',
        featureState: {
          'Major Bolster Potion': { majorBolsterActive: true },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Bolster Potion',
          key: 'majorBolsterActive',
          value: false,
        }),
      })
    );
  });

  it('onRest (long rest) clears the buff flag', () => {
    const { mutations } = runIntent(
      { ...MajorBolsterPotion, _ownerInstanceId: 'char-1' },
      {
        actionType: 'longRest',
        featureState: {
          'Major Bolster Potion': { majorBolsterActive: true },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Bolster Potion',
          key: 'majorBolsterActive',
          value: false,
        }),
      })
    );
  });
});
