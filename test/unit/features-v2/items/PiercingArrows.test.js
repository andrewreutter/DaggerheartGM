import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { PiercingArrows } from '../../../../src/features-v2/items/PiercingArrows.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll, runIntent } from '../helpers.js';

const shortbow = {
  id: 'w-shortbow',
  name: 'Shortbow',
  damage: 'd8',
  tier: 1,
  trait: 'agility',
  range: 'Far',
};

describe('Items — Piercing Arrows', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ id: 'srd-itm-piercing-arrows', name: 'Piercing Arrows' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Piercing Arrows',
        _source: 'item',
        _itemId: 'srd-itm-piercing-arrows',
        chips: PiercingArrows.chips,
      })
    );
  });

  it('intent chip adds Proficiency to damage and decrements uses', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      proficiency: 2,
      primaryWeapon: shortbow,
      weapons: [shortbow],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Piercing Arrows',
      featureState: { 'Piercing Arrows': {} },
      rolls: mockRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1'],
        weaponId: 'w-shortbow',
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...PiercingArrows, _ownerInstanceId: 'c1' }], 'intent', tbl);
    const chip = chips.find((c) => c.name === 'Add Proficiency (Piercing Arrows)');
    expect(chip).toBeDefined();
    const fromUse = [...activateChip(chip, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Piercing Arrows',
          value: 2,
        }),
      })
    );
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Piercing Arrows',
          key: 'piercingArrowsUsesRemaining',
          value: 2,
        }),
      })
    );
  });

  it('does not offer the chip on a miss', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      primaryWeapon: shortbow,
      weapons: [shortbow],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Piercing Arrows',
      featureState: { 'Piercing Arrows': {} },
      rolls: mockRoll({ isSuccess: false }),
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1'],
        weaponId: 'w-shortbow',
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...PiercingArrows, _ownerInstanceId: 'c1' }], 'intent', tbl);
    expect(chips.find((c) => c.name === 'Add Proficiency (Piercing Arrows)')).toBeUndefined();
  });

  it('onRest resets uses to 3', () => {
    const { mutations } = runIntent(
      { ...PiercingArrows, _ownerInstanceId: 'c1' },
      {
        actionType: 'shortRest',
        featureState: {
          'Piercing Arrows': { piercingArrowsUsesRemaining: 0 },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Piercing Arrows',
          key: 'piercingArrowsUsesRemaining',
          value: 3,
        }),
      })
    );
  });
});
