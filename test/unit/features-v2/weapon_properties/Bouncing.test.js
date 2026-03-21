import { describe, it, expect } from 'vitest';
import { Bouncing } from '../../../../src/features-v2/weapon_properties/Bouncing.js';
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

describe('Bouncing', () => {
  const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
  const advPrimary = mockAdversary({ instanceId: 'adv-1', tokenX: 3, tokenY: 0 }); // melee
  const advSecond = mockAdversary({ instanceId: 'adv-2', name: 'Goblin 2', tokenX: 8, tokenY: 0 }); // veryClose
  const advFar = mockAdversary({ instanceId: 'adv-far', name: 'Archer', tokenX: 200, tokenY: 0 }); // veryFar

  const baseOverrides = {
    activeElements: [char, advPrimary, advSecond],
    action: mockAction({
      type: 'attack',
      actorInstanceId: 'char-1',
      targetInstanceIds: ['adv-1'],
      range: 'close',
    }),
    rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
  };

  it('shows a resolve-phase chip on attacks', () => {
    const { chips } = runResolve(Bouncing, baseOverrides);
    expect(chips).toHaveLength(1);
    expect(chips[0]._featureName).toBe('Bouncing');
    expect(chips[0].placements).toContain('resolve');
    expect(chips[0].stressCost).toBe(1);
    expect(chips[0].loop).toBe(true);
  });

  it('does not show chip on non-attack actions', () => {
    const { chips } = runResolve(Bouncing, {
      ...baseOverrides,
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1' }),
    });
    expect(chips).toHaveLength(0);
  });

  it('does not show chip when not acting', () => {
    const other = mockCharacter({ instanceId: 'char-2' });
    const { chips } = runResolve({ ...Bouncing, _ownerInstanceId: 'char-2' }, {
      ...baseOverrides,
      activeElements: [char, other, advPrimary, advSecond],
    });
    expect(chips).toHaveLength(0);
  });

  it('isTargetSelect returns actors within range, excluding primary target and self', () => {
    const { chips } = runResolve(Bouncing, baseOverrides);
    expect(chips).toHaveLength(1);

    const table = mockTable({
      ...baseOverrides,
      _ownerInstanceId: 'char-1',
    });

    const targets = chips[0].isTargetSelect(table);
    const targetIds = targets.map((t) => t.instanceId);

    expect(targetIds).toContain('adv-2');
    expect(targetIds).not.toContain('adv-1'); // primary target excluded
    expect(targetIds).not.toContain('char-1'); // self excluded
  });

  it('isTargetSelect excludes actors outside weapon range', () => {
    const { chips } = runResolve(Bouncing, {
      ...baseOverrides,
      activeElements: [char, advPrimary, advSecond, advFar],
    });

    const table = mockTable({
      ...baseOverrides,
      activeElements: [char, advPrimary, advSecond, advFar],
      _ownerInstanceId: 'char-1',
    });

    const targets = chips[0].isTargetSelect(table);
    const targetIds = targets.map((t) => t.instanceId);

    expect(targetIds).toContain('adv-2');
    expect(targetIds).not.toContain('adv-far'); // veryFar is outside 'close' range
  });

  it('onUse queues addDamageRoll for the selected target', () => {
    const { chips } = runResolve(Bouncing, baseOverrides);
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
          name: 'Bouncing',
          dice: 'd8',
          targetInstanceIds: ['adv-2'],
        }),
      })
    );
  });

  it('onUse reads weapon die from the damage roll', () => {
    const overrides = {
      ...baseOverrides,
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: '2d6', value: 7 }] }),
    };
    const { chips } = runResolve(Bouncing, overrides);

    const table = mockTable({
      ...overrides,
      _ownerInstanceId: 'char-1',
    });

    const chipState = mockChipState();
    chipState.set('selectedTargetId', 'adv-2');
    chips[0].onUse(table, chipState);

    const mutations = applyMutations(table);
    const dmgRoll = mutations.find((m) => m.type === 'addDamageRoll');
    expect(dmgRoll.payload.dice).toBe('2d6');
  });

  it('activateChip stores selectedTargetId in chip state', () => {
    const { chips } = runResolve(Bouncing, baseOverrides);
    const table = mockTable({
      ...baseOverrides,
      _ownerInstanceId: 'char-1',
    });

    const chipState = mockChipState();
    activateChip(chips[0], table, chipState, { selectedTargetId: 'adv-2' });

    expect(chipState.get('selectedTargetId')).toBe('adv-2');
  });
});
