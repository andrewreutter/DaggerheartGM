import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { MajorControlPotion } from '../../../../src/features-v2/consumables/MajorControlPotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Major Control Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Major Control Potion', id: 'srd-cns-major-control-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Major Control Potion',
        description: MajorControlPotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-major-control-potion',
      })
    );
  });

  it('onUse queues setFeatureState to activate Finesse bonus', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: char.instanceId,
      _featureKey: 'Major Control Potion',
    });
    const table = buildTableSnapshot(gs);
    MajorControlPotion.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Control Potion',
          key: 'majorControlActive',
          value: true,
        }),
      })
    );
  });

  it('passiveStatMods adds +1 Finesse while active in featureState', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-cns-major-control-potion', name: 'Major Control Potion' }],
      featureState: {
        'Major Control Potion': { majorControlActive: true },
      },
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.stats.finesse).toBe(1);
  });

  it('does not add Finesse when the potion effect is inactive', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-cns-major-control-potion', name: 'Major Control Potion' }],
      featureState: {
        'Major Control Potion': { majorControlActive: false },
      },
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.stats.finesse).toBe(0);
  });

  it('onRest (short rest) clears the buff flag', () => {
    const { mutations } = runIntent(
      { ...MajorControlPotion, _ownerInstanceId: 'char-1' },
      {
        actionType: 'shortRest',
        featureState: {
          'Major Control Potion': { majorControlActive: true },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Control Potion',
          key: 'majorControlActive',
          value: false,
        }),
      })
    );
  });

  it('onRest (long rest) clears the buff flag', () => {
    const { mutations } = runIntent(
      { ...MajorControlPotion, _ownerInstanceId: 'char-1' },
      {
        actionType: 'longRest',
        featureState: {
          'Major Control Potion': { majorControlActive: true },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Control Potion',
          key: 'majorControlActive',
          value: false,
        }),
      })
    );
  });
});
