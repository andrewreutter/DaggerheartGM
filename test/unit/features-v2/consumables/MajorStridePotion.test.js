import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { MajorStridePotion } from '../../../../src/features-v2/consumables/MajorStridePotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Major Stride Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Major Stride Potion', id: 'srd-cns-major-stride-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Major Stride Potion',
        description: MajorStridePotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-major-stride-potion',
      })
    );
  });

  it('onUse queues setFeatureState to activate Agility bonus', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: char.instanceId,
      _featureKey: 'Major Stride Potion',
    });
    const table = buildTableSnapshot(gs);
    MajorStridePotion.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Stride Potion',
          key: 'majorStrideActive',
          value: true,
        }),
      })
    );
  });

  it('passiveStatMods adds +1 Agility while active in featureState', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-cns-major-stride-potion', name: 'Major Stride Potion' }],
      featureState: {
        'Major Stride Potion': { majorStrideActive: true },
      },
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.stats.agility).toBe(2);
  });

  it('does not add Agility when the potion effect is inactive', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-cns-major-stride-potion', name: 'Major Stride Potion' }],
      featureState: {
        'Major Stride Potion': { majorStrideActive: false },
      },
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.stats.agility).toBe(1);
  });

  it('onRest (short rest) clears the buff flag', () => {
    const { mutations } = runIntent(
      { ...MajorStridePotion, _ownerInstanceId: 'char-1' },
      {
        actionType: 'shortRest',
        featureState: {
          'Major Stride Potion': { majorStrideActive: true },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Stride Potion',
          key: 'majorStrideActive',
          value: false,
        }),
      })
    );
  });

  it('onRest (long rest) clears the buff flag', () => {
    const { mutations } = runIntent(
      { ...MajorStridePotion, _ownerInstanceId: 'char-1' },
      {
        actionType: 'longRest',
        featureState: {
          'Major Stride Potion': { majorStrideActive: true },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Stride Potion',
          key: 'majorStrideActive',
          value: false,
        }),
      })
    );
  });
});
