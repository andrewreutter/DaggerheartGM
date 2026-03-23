import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { AttunePotion } from '../../../../src/features-v2/consumables/AttunePotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Attune Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Attune Potion', id: 'srd-cns-attune-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Attune Potion',
        description: AttunePotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-attune-potion',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Attune Potion' }],
      }),
      registry
    );
    expect(
      feats.some((f) => f.name === 'Attune Potion' && f._source === 'consumable')
    ).toBe(true);
  });

  it('onUse queues setFeatureState for the pending Instinct bonus', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: char.instanceId,
      _featureKey: 'Attune Potion',
    });
    const table = buildTableSnapshot(gs);
    AttunePotion.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Attune Potion',
          key: 'pendingNextInstinctRoll',
          value: true,
        }),
      })
    );
  });

  it('onIntent adds +1 to the action roll when pending and clears pending', () => {
    const { mutations } = runIntent(
      { ...AttunePotion, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Attune Potion': { pendingNextInstinctRoll: true },
        },
        action: { traitKey: 'Instinct' },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Attune Potion',
          value: 1,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Attune Potion',
          key: 'pendingNextInstinctRoll',
          value: false,
        }),
      })
    );
  });

  it('onIntent does nothing when not pending', () => {
    const { mutations } = runIntent(
      { ...AttunePotion, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Attune Potion': { pendingNextInstinctRoll: false },
        },
        action: { traitKey: 'Instinct' },
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });

  it('onIntent does nothing when the roll is not Instinct', () => {
    const { mutations } = runIntent(
      { ...AttunePotion, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Attune Potion': { pendingNextInstinctRoll: true },
        },
        action: { traitKey: 'Strength' },
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });
});
