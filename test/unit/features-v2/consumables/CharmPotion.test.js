import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { CharmPotion } from '../../../../src/features-v2/consumables/CharmPotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Charm Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Charm Potion', id: 'srd-cns-charm-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Charm Potion',
        description: CharmPotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-charm-potion',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Charm Potion' }],
      }),
      registry
    );
    expect(
      feats.some((f) => f.name === 'Charm Potion' && f._source === 'consumable')
    ).toBe(true);
  });

  it('onUse queues setFeatureState for the pending Presence bonus', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: char.instanceId,
      _featureKey: 'Charm Potion',
    });
    const table = buildTableSnapshot(gs);
    CharmPotion.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Charm Potion',
          key: 'pendingNextPresenceRoll',
          value: true,
        }),
      })
    );
  });

  it('onIntent adds +1 to the action roll when pending and clears pending', () => {
    const { mutations } = runIntent(
      { ...CharmPotion, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Charm Potion': { pendingNextPresenceRoll: true },
        },
        action: { traitKey: 'Presence' },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Charm Potion',
          value: 1,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Charm Potion',
          key: 'pendingNextPresenceRoll',
          value: false,
        }),
      })
    );
  });

  it('onIntent does nothing when not pending', () => {
    const { mutations } = runIntent(
      { ...CharmPotion, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Charm Potion': { pendingNextPresenceRoll: false },
        },
        action: { traitKey: 'Presence' },
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });

  it('onIntent does nothing when the roll is not Presence', () => {
    const { mutations } = runIntent(
      { ...CharmPotion, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Charm Potion': { pendingNextPresenceRoll: true },
        },
        action: { traitKey: 'Agility' },
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });
});
