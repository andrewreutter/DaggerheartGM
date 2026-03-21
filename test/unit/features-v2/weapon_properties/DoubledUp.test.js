import { describe, it, expect } from 'vitest';
import { DoubledUp } from '../../../../src/features-v2/weapon_properties/DoubledUp.js';
import {
  runResolve,
  mockRoll,
  mockAction,
  mockCharacter,
  mockAdversary,
  mockTable,
  mockChipState,
} from '../helpers.js';
import { activateChip } from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Doubled Up', () => {
  const secWeapon = { id: 'sec-1', name: 'Dagger', tier: 1, range: 'melee', trait: 'finesse', damage: 'd6' };
  const char = mockCharacter({
    instanceId: 'char-1',
    tokenX: 0,
    tokenY: 0,
    weapons: [
      { id: 'pri-1', name: 'Longsword', tier: 1, range: 'melee', trait: 'agility', damage: 'd8' },
      secWeapon,
    ],
  });
  const advPrimary = mockAdversary({ instanceId: 'adv-1', tokenX: 3, tokenY: 0 }); // melee
  const advMelee = mockAdversary({ instanceId: 'adv-2', name: 'Goblin 2', tokenX: 4, tokenY: 0 }); // melee
  const advFar = mockAdversary({ instanceId: 'adv-far', name: 'Archer', tokenX: 200, tokenY: 0 }); // veryFar

  const baseOverrides = {
    activeElements: [char, advPrimary, advMelee],
    action: mockAction({
      type: 'attack',
      actorInstanceId: 'char-1',
      targetInstanceIds: ['adv-1'],
      range: 'melee',
    }),
    rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
  };

  it('shows a resolve-phase chip on attacks', () => {
    const { chips } = runResolve(DoubledUp, baseOverrides);
    expect(chips).toHaveLength(1);
    expect(chips[0]._featureName).toBe('Doubled Up');
    expect(chips[0].placements).toContain('resolve');
    expect(chips[0].loop).toBeUndefined();
  });

  it('does not show chip on non-attack actions', () => {
    const { chips } = runResolve(DoubledUp, {
      ...baseOverrides,
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1' }),
    });
    expect(chips).toHaveLength(0);
  });

  it('does not show chip when not acting', () => {
    const other = mockCharacter({ instanceId: 'char-2' });
    const { chips } = runResolve({ ...DoubledUp, _ownerInstanceId: 'char-2' }, {
      ...baseOverrides,
      activeElements: [char, other, advPrimary, advMelee],
    });
    expect(chips).toHaveLength(0);
  });

  it('isTargetSelect returns Melee-range actors only, excluding primary target and self', () => {
    const { chips } = runResolve(DoubledUp, {
      ...baseOverrides,
      activeElements: [char, advPrimary, advMelee, advFar],
    });

    const table = mockTable({
      ...baseOverrides,
      activeElements: [char, advPrimary, advMelee, advFar],
      _ownerInstanceId: 'char-1',
    });

    const targets = chips[0].isTargetSelect(table);
    const targetIds = targets.map((t) => t.instanceId);

    expect(targetIds).toContain('adv-2');
    expect(targetIds).not.toContain('adv-1'); // primary target excluded
    expect(targetIds).not.toContain('adv-far'); // not melee
    expect(targetIds).not.toContain('char-1'); // self excluded
  });

  it('onUse queues addDamageRoll with secondary weapon damage for the selected target', () => {
    const { chips } = runResolve(DoubledUp, baseOverrides);
    expect(chips).toHaveLength(1);

    const table = mockTable({
      ...baseOverrides,
      _ownerInstanceId: 'char-1',
    });

    const chipState = mockChipState();
    chipState.set('selectedTargetId', 'adv-2');
    chips[0].onUse(table, chipState);

    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addDamageRoll',
        payload: expect.objectContaining({
          name: 'Doubled Up',
          dice: 'd6',
          targetInstanceIds: ['adv-2'],
        }),
      })
    );
  });

  it('activateChip stores selectedTargetId in chip state', () => {
    const { chips } = runResolve(DoubledUp, baseOverrides);
    const table = mockTable({
      ...baseOverrides,
      _ownerInstanceId: 'char-1',
    });

    const chipState = mockChipState();
    activateChip(chips[0], table, chipState, { selectedTargetId: 'adv-2' });

    expect(chipState.get('selectedTargetId')).toBe('adv-2');
  });

  it('falls back to d6 when no secondary weapon is equipped', () => {
    const charNoSec = mockCharacter({
      instanceId: 'char-1',
      tokenX: 0,
      tokenY: 0,
      weapons: [{ id: 'pri-1', name: 'Longsword', tier: 1, range: 'melee', trait: 'agility', damage: 'd8' }],
    });

    const overrides = {
      ...baseOverrides,
      activeElements: [charNoSec, advPrimary, advMelee],
    };
    const { chips } = runResolve(DoubledUp, overrides);

    const table = mockTable({
      ...overrides,
      _ownerInstanceId: 'char-1',
    });

    const chipState = mockChipState();
    chipState.set('selectedTargetId', 'adv-2');
    chips[0].onUse(table, chipState);

    const mutations = applyMutations(table);
    const dmgRoll = mutations.find((m) => m.type === 'addDamageRoll');
    expect(dmgRoll.payload.dice).toBe('d6');
  });
});
