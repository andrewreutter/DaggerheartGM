import { describe, it, expect } from 'vitest';
import { Bouncing } from '../../../../src/features-v2/weapon_properties/Bouncing.js';
import { runReviewAction, mockRoll, mockAction, mockTable, mockChipState, mockCharacter, mockAdversary } from '../helpers.js';
import { activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Bouncing', () => {
  const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
  const advTarget = mockAdversary({ instanceId: 'adv-1', tokenX: 3, tokenY: 0 }); // melee
  const advBounce1 = mockAdversary({ instanceId: 'adv-2', name: 'Goblin 2', tokenX: 4, tokenY: 0 }); // melee
  const advBounce2 = mockAdversary({ instanceId: 'adv-3', name: 'Goblin 3', tokenX: 20, tokenY: 0 }); // close

  it('shows chip during reviewAction on an attack', () => {
    const { chips } = runReviewAction(Bouncing, {
      activeElements: [char, advTarget, advBounce1],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll(),
    });

    expect(chips).toHaveLength(1);
    expect(chips[0]._featureName).toBe('Bouncing');
    expect(chips[0].multiSelect).toBe(true);
    expect(typeof chips[0].selectTargets).toBe('function');
  });

  it('does not show chip on non-attack actions', () => {
    const { chips } = runReviewAction(Bouncing, {
      activeElements: [char, advTarget, advBounce1],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll(),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show chip when the owner is not acting', () => {
    const other = mockCharacter({ instanceId: 'char-2' });
    const { chips } = runReviewAction({ ...Bouncing, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, advTarget, advBounce1],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll(),
    });

    expect(chips).toHaveLength(0);
  });

  it('selectTargets excludes the original target and out-of-range adversaries', () => {
    const advFar = mockAdversary({ instanceId: 'adv-far', tokenX: 200, tokenY: 0 });
    const state = {
      activeElements: [char, advTarget, advBounce1, advBounce2, advFar],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
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
    // Give character a melee weapon
    state.activeElements[0] = {
      ...char,
      primaryWeapon: { name: 'Sword', range: 'melee', damage: 'd8', trait: 'Agility' },
    };
    const table = buildTableSnapshot(state);

    const { chips } = runReviewAction(Bouncing, {
      ...state,
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
    });
    expect(chips).toHaveLength(1);

    const validTargets = chips[0].selectTargets(table);
    const validIds = validTargets.map((t) => t.instanceId);

    expect(validIds).not.toContain('adv-1'); // original target excluded
    expect(validIds).toContain('adv-2'); // melee range, included
    expect(validIds).not.toContain('adv-far'); // far beyond melee, excluded
  });

  it('onUse queues addDamageRoll for each selected bounce target', () => {
    const charWithWeapon = {
      ...char,
      primaryWeapon: { name: 'Throwing Star', range: 'close', damage: 'd6', trait: 'Agility' },
    };
    const state = {
      activeElements: [charWithWeapon, advTarget, advBounce1, advBounce2],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
      featureState: {},
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'close',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    };
    const table = buildTableSnapshot(state);

    const chipState = mockChipState({ selectedTargetIds: ['adv-2', 'adv-3'] });
    const chip = Bouncing.chips[0]._value; // unwrap the when() wrapper

    chip.onUse(table, chipState);
    const mutations = applyMutations(table);

    const damageRolls = mutations.filter((m) => m.type === 'addDamageRoll');
    expect(damageRolls).toHaveLength(2);
    expect(damageRolls[0].payload).toMatchObject({
      name: 'Bouncing',
      dice: 'd6',
      targetInstanceIds: ['adv-2'],
    });
    expect(damageRolls[1].payload).toMatchObject({
      name: 'Bouncing',
      dice: 'd6',
      targetInstanceIds: ['adv-3'],
    });
  });

  it('onUse stores bounceTargets count in feature state for stressCost', () => {
    const charWithWeapon = {
      ...char,
      primaryWeapon: { name: 'Star', range: 'close', damage: 'd6', trait: 'Agility' },
    };
    const state = {
      activeElements: [charWithWeapon, advTarget, advBounce1, advBounce2],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
      featureState: {},
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'close',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    };
    const table = buildTableSnapshot(state);

    const chipState = mockChipState({ selectedTargetIds: ['adv-2', 'adv-3'] });
    const chip = Bouncing.chips[0]._value;

    chip.onUse(table, chipState);

    expect(table.feature.get('bounceTargets')).toBe(2);
  });

  it('stressCost reads bounceTargets from feature state', () => {
    const state = {
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
      featureState: {},
    };
    const table = buildTableSnapshot(state);
    const chip = Bouncing.chips[0]._value;

    // Before onUse sets bounceTargets, cost should be 0
    expect(chip.stressCost(table)).toBe(0);

    table.feature.set('bounceTargets', 3);
    expect(chip.stressCost(table)).toBe(3);
  });
});
