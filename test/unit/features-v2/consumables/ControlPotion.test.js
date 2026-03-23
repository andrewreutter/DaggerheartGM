import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { ControlPotion } from '../../../../src/features-v2/consumables/ControlPotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Control Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ id: 'srd-cns-control-potion', name: 'Control Potion', quantity: 1 }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Control Potion',
        description: ControlPotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-control-potion',
      })
    );
  });

  it('onUse arms the next Finesse roll via feature state', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const gs = mockGameState({
      activeElements: [char, mockAdversary()],
      _ownerInstanceId: 'c1',
      _featureKey: 'Control Potion',
    });
    const table = buildTableSnapshot(gs);
    ControlPotion.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Control Potion',
          key: 'pendingNextFinesseRoll',
          value: true,
        }),
      })
    );
  });

  it('onIntent applies +1 to a Finesse roll and clears the pending flag', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const feat = { ...ControlPotion, _ownerInstanceId: 'char-1' };

    const { mutations } = runIntent(feat, {
      activeElements: [char, adv],
      action: { traitKey: 'Finesse', type: 'trait' },
      featureState: { 'Control Potion': { pendingNextFinesseRoll: true } },
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Control Potion', value: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Control Potion',
          key: 'pendingNextFinesseRoll',
          value: false,
        }),
      })
    );
  });

  it('does not apply when the roll is not Finesse', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const { mutations } = runIntent(
      { ...ControlPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, mockAdversary()],
        action: { traitKey: 'Agility', type: 'trait' },
        featureState: { 'Control Potion': { pendingNextFinesseRoll: true } },
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollStatic')).toEqual([]);
  });
});
