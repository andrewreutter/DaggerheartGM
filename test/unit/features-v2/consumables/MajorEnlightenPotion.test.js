import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { MajorEnlightenPotion } from '../../../../src/features-v2/consumables/MajorEnlightenPotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Major Enlighten Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Major Enlighten Potion', id: 'srd-cns-major-enlighten-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Major Enlighten Potion',
        description: MajorEnlightenPotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-major-enlighten-potion',
      })
    );
  });

  it('onUse queues setFeatureState to activate Knowledge bonus', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: char.instanceId,
      _featureKey: 'Major Enlighten Potion',
    });
    const table = buildTableSnapshot(gs);
    MajorEnlightenPotion.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Enlighten Potion',
          key: 'majorEnlightenActive',
          value: true,
        }),
      })
    );
  });

  it('passiveStatMods adds +1 Knowledge while active in featureState', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-cns-major-enlighten-potion', name: 'Major Enlighten Potion' }],
      featureState: {
        'Major Enlighten Potion': { majorEnlightenActive: true },
      },
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.stats.knowledge).toBe(1);
  });

  it('does not add Knowledge when the potion effect is inactive', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-cns-major-enlighten-potion', name: 'Major Enlighten Potion' }],
      featureState: {
        'Major Enlighten Potion': { majorEnlightenActive: false },
      },
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.stats.knowledge).toBe(0);
  });

  it('onRest (short rest) clears the buff flag', () => {
    const { mutations } = runIntent(
      { ...MajorEnlightenPotion, _ownerInstanceId: 'char-1' },
      {
        actionType: 'shortRest',
        featureState: {
          'Major Enlighten Potion': { majorEnlightenActive: true },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Enlighten Potion',
          key: 'majorEnlightenActive',
          value: false,
        }),
      })
    );
  });

  it('onRest (long rest) clears the buff flag', () => {
    const { mutations } = runIntent(
      { ...MajorEnlightenPotion, _ownerInstanceId: 'char-1' },
      {
        actionType: 'longRest',
        featureState: {
          'Major Enlighten Potion': { majorEnlightenActive: true },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Major Enlighten Potion',
          key: 'majorEnlightenActive',
          value: false,
        }),
      })
    );
  });
});
