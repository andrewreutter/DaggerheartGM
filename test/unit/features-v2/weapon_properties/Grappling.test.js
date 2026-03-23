import { describe, it, expect } from 'vitest';
import { Grappling } from '../../../../src/features-v2/weapon_properties/Grappling.js';
import { runReviewAction, mockRoll, mockAction, mockTable } from '../helpers.js';
import { activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';

describe('Grappling', () => {
  it('shows two reviewAction chips on successful attack', () => {
    const { chips } = runReviewAction(Grappling, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });
    expect(chips).toHaveLength(2);
    expect(chips.every((c) => c.placements?.includes('reviewAction'))).toBe(true);
    expect(chips.map((c) => c.name)).toEqual([
      'Grappling (Restrain)',
      'Grappling (Pull into Melee)',
    ]);
  });

  it('queues addCondition when Restrain chip is activated', () => {
    const overrides = {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    };
    const table = mockTable(overrides);
    const { chips } = runReviewAction(Grappling, overrides);
    const restrain = chips.find((c) => c.name === 'Grappling (Restrain)');
    expect(restrain).toBeDefined();
    const mutations = activateChip(restrain, table, makeChipState(), {});
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: expect.objectContaining({ condition: 'Restrained' }),
      })
    );
  });

  it('queues move when Pull into Melee chip is activated', () => {
    const overrides = {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    };
    const table = mockTable(overrides);
    const { chips } = runReviewAction(Grappling, overrides);
    const pull = chips.find((c) => c.name === 'Grappling (Pull into Melee)');
    expect(pull).toBeDefined();
    const mutations = activateChip(pull, table, makeChipState(), {});
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({
          desiredCondition: 'In Melee range from attacker',
          description: 'Pull into Melee range.',
        }),
      })
    );
  });

  it('does not show chips when the attack fails', () => {
    const { chips } = runReviewAction(Grappling, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });
    expect(chips).toHaveLength(0);
  });

  it('does not show chips on non-attack actions', () => {
    const { chips } = runReviewAction(Grappling, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: true }),
    });
    expect(chips).toHaveLength(0);
  });
});
