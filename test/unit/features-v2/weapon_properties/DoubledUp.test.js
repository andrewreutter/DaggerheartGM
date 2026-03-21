import { describe, it, expect } from 'vitest';
import { DoubledUp } from '../../../../src/features-v2/weapon_properties/DoubledUp.js';
import { runReviewAction, mockRoll, mockAction, mockTable, mockChipState, mockCharacter, mockAdversary } from '../helpers.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Doubled Up', () => {
  const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
  const advTarget = mockAdversary({ instanceId: 'adv-1', tokenX: 3, tokenY: 0 }); // melee
  const advMelee = mockAdversary({ instanceId: 'adv-2', name: 'Goblin 2', tokenX: 4, tokenY: 0 }); // melee
  const advFar = mockAdversary({ instanceId: 'adv-3', name: 'Archer', tokenX: 80, tokenY: 0 }); // far

  it('shows chip during reviewAction on an attack', () => {
    const { chips } = runReviewAction(DoubledUp, {
      activeElements: [char, advTarget, advMelee],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll(),
    });

    expect(chips).toHaveLength(1);
    expect(chips[0]._featureName).toBe('Doubled Up');
    expect(typeof chips[0].selectTargets).toBe('function');
    expect(chips[0].multiSelect).toBeUndefined();
  });

  it('does not show chip on non-attack actions', () => {
    const { chips } = runReviewAction(DoubledUp, {
      activeElements: [char, advTarget, advMelee],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll(),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show chip when the owner is not acting', () => {
    const other = mockCharacter({ instanceId: 'char-2' });
    const { chips } = runReviewAction({ ...DoubledUp, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, advTarget, advMelee],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll(),
    });

    expect(chips).toHaveLength(0);
  });

  it('selectTargets only includes adversaries in melee range, excluding original target', () => {
    const state = {
      activeElements: [char, advTarget, advMelee, advFar],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Doubled Up',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    };
    const table = buildTableSnapshot(state);

    const { chips } = runReviewAction(DoubledUp, {
      ...state,
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
    });
    expect(chips).toHaveLength(1);

    const validTargets = chips[0].selectTargets(table);
    const validIds = validTargets.map((t) => t.instanceId);

    expect(validIds).not.toContain('adv-1'); // original target excluded
    expect(validIds).toContain('adv-2'); // melee range, included
    expect(validIds).not.toContain('adv-3'); // far range, excluded
  });

  it('onUse queues addDamageRoll with secondary weapon damage for the selected target', () => {
    const charWithWeapons = {
      ...char,
      primaryWeapon: { name: 'Longsword', range: 'melee', damage: 'd10', trait: 'Strength' },
      secondaryWeapon: { name: 'Dagger', range: 'melee', damage: 'd6', trait: 'Finesse' },
      weapons: [
        { name: 'Longsword', range: 'melee', damage: 'd10', trait: 'Strength' },
        { name: 'Dagger', range: 'melee', damage: 'd6', trait: 'Finesse' },
      ],
    };
    const state = {
      activeElements: [charWithWeapons, advTarget, advMelee],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Doubled Up',
      featureState: {},
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Strength',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    };
    const table = buildTableSnapshot(state);

    const chipState = mockChipState({ selectedTargetIds: ['adv-2'] });
    const chip = DoubledUp.chips[0]._value;

    chip.onUse(table, chipState);
    const mutations = applyMutations(table);

    const damageRolls = mutations.filter((m) => m.type === 'addDamageRoll');
    expect(damageRolls).toHaveLength(1);
    expect(damageRolls[0].payload).toMatchObject({
      name: 'Doubled Up',
      dice: 'd6',
      targetInstanceIds: ['adv-2'],
    });
  });

  it('onUse does nothing when no target is selected', () => {
    const state = {
      activeElements: [char, advTarget, advMelee],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Doubled Up',
      featureState: {},
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    };
    const table = buildTableSnapshot(state);

    const chipState = mockChipState({ selectedTargetIds: [] });
    const chip = DoubledUp.chips[0]._value;

    chip.onUse(table, chipState);
    const mutations = applyMutations(table);

    expect(mutations.filter((m) => m.type === 'addDamageRoll')).toHaveLength(0);
  });

  it('has no hopeCost or stressCost', () => {
    const chip = DoubledUp.chips[0]._value;
    expect(chip.hopeCost).toBeUndefined();
    expect(chip.stressCost).toBeUndefined();
  });
});
