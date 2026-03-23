import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { MajorAttunePotion } from '../../../../src/features-v2/consumables/MajorAttunePotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Major Attune Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Major Attune Potion', id: 'srd-cns-major-attune-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Major Attune Potion',
        description: MajorAttunePotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-major-attune-potion',
      })
    );
  });

  it('onUse queues setFeatureState to activate Instinct bonus', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: char.instanceId,
      _featureKey: 'Major Attune Potion',
    });
    const table = buildTableSnapshot(gs);
    MajorAttunePotion.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Attune Potion',
          key: 'majorAttuneActive',
          value: true,
        }),
      })
    );
  });

  it('passiveStatMods adds +1 Instinct while active in featureState', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-cns-major-attune-potion', name: 'Major Attune Potion' }],
      featureState: {
        'Major Attune Potion': { majorAttuneActive: true },
      },
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.stats.instinct).toBe(1);
  });

  it('does not add Instinct when the potion effect is inactive', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-cns-major-attune-potion', name: 'Major Attune Potion' }],
      featureState: {
        'Major Attune Potion': { majorAttuneActive: false },
      },
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.stats.instinct).toBe(0);
  });

  it('onRest (short rest) clears the buff flag', () => {
    const { mutations } = runIntent(
      { ...MajorAttunePotion, _ownerInstanceId: 'char-1' },
      {
        actionType: 'shortRest',
        featureState: {
          'Major Attune Potion': { majorAttuneActive: true },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Attune Potion',
          key: 'majorAttuneActive',
          value: false,
        }),
      })
    );
  });

  it('onRest (long rest) clears the buff flag', () => {
    const { mutations } = runIntent(
      { ...MajorAttunePotion, _ownerInstanceId: 'char-1' },
      {
        actionType: 'longRest',
        featureState: {
          'Major Attune Potion': { majorAttuneActive: true },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Attune Potion',
          key: 'majorAttuneActive',
          value: false,
        }),
      })
    );
  });
});
