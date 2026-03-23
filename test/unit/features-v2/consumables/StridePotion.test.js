import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { StridePotion } from '../../../../src/features-v2/consumables/StridePotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Stride Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Stride Potion', id: 'srd-cns-stride-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Stride Potion',
        description: StridePotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-stride-potion',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Stride Potion' }],
      }),
      registry
    );
    expect(
      feats.some((f) => f.name === 'Stride Potion' && f._source === 'consumable')
    ).toBe(true);
  });

  it('onUse queues setFeatureState for the pending Agility bonus', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: char.instanceId,
      _featureKey: 'Stride Potion',
    });
    const table = buildTableSnapshot(gs);
    StridePotion.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Stride Potion',
          key: 'pendingNextAgilityRoll',
          value: true,
        }),
      })
    );
  });

  it('onIntent adds +1 to the action roll when pending and clears pending', () => {
    const { mutations } = runIntent(
      { ...StridePotion, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Stride Potion': { pendingNextAgilityRoll: true },
        },
        action: { traitKey: 'Agility' },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Stride Potion',
          value: 1,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Stride Potion',
          key: 'pendingNextAgilityRoll',
          value: false,
        }),
      })
    );
  });

  it('onIntent does nothing when not pending', () => {
    const { mutations } = runIntent(
      { ...StridePotion, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Stride Potion': { pendingNextAgilityRoll: false },
        },
        action: { traitKey: 'Agility' },
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });

  it('onIntent does nothing when the roll is not Agility', () => {
    const { mutations } = runIntent(
      { ...StridePotion, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Stride Potion': { pendingNextAgilityRoll: true },
        },
        action: { traitKey: 'Strength' },
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });
});
