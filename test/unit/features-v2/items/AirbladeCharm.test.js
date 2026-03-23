import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { AirbladeCharm } from '../../../../src/features-v2/items/AirbladeCharm.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll, runIntent, runReviewOutcome } from '../helpers.js';

const dagger = {
  id: 'w-dagger',
  name: 'Dagger',
  damage: 'd6',
  tier: 1,
  trait: 'agility',
  range: 'melee',
};

describe('Items — Airblade Charm', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ id: 'srd-itm-airblade-charm', name: 'Airblade Charm' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Airblade Charm',
        _source: 'item',
        _itemId: 'srd-itm-airblade-charm',
        chips: AirbladeCharm.chips,
      })
    );
  });

  it('intent chip sets active flag and decrements uses', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      primaryWeapon: dagger,
      weapons: [dagger],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Airblade Charm',
      featureState: { 'Airblade Charm': {} },
      rolls: mockRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1'],
        weaponId: 'w-dagger',
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...AirbladeCharm, _ownerInstanceId: 'c1' }], 'intent', tbl);
    const chip = chips.find((c) => c.name === 'Activate Airblade Charm');
    expect(chip).toBeDefined();
    const fromUse = [...activateChip(chip, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Airblade Charm',
          key: 'airbladeThisAttack',
          value: true,
        }),
      })
    );
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Airblade Charm',
          key: 'airbladeCharmUsesRemaining',
          value: 2,
        }),
      })
    );
  });

  it('declarative rangeOverrides apply melee → close when active flag is set', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-itm-airblade-charm', name: 'Airblade Charm' }],
      featureState: {
        'Airblade Charm': { airbladeThisAttack: true },
      },
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.rangeOverrides).toEqual({ melee: 'close' });
  });

  it('onRest resets uses to 3', () => {
    const { mutations } = runIntent(
      { ...AirbladeCharm, _ownerInstanceId: 'c1' },
      {
        actionType: 'shortRest',
        featureState: {
          'Airblade Charm': { airbladeCharmUsesRemaining: 0 },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Airblade Charm',
          key: 'airbladeCharmUsesRemaining',
          value: 3,
        }),
      })
    );
  });

  it('onReviewOutcome clears active flag after an attack', () => {
    const { mutations } = runReviewOutcome(
      { ...AirbladeCharm, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Airblade Charm': { airbladeThisAttack: true, airbladeCharmUsesRemaining: 2 },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Airblade Charm',
          key: 'airbladeThisAttack',
          value: false,
        }),
      })
    );
  });
});
