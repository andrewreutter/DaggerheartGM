import { describe, it, expect } from 'vitest';
import { Grappling } from '../../../../src/features-v2/weapon_properties/Grappling.js';
import { runReviewAction, mockRoll, mockAction, mockTable } from '../helpers.js';
import { activateChip } from '../../../../src/features-v2/engine/chip-system.js';

describe('Grappling', () => {
  it('shows two chips on successful attack (Restrain and Pull)', () => {
    const { chips } = runReviewAction(Grappling, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(2);
    expect(chips[0].hopeCost).toBe(1);
    expect(chips[1].hopeCost).toBe(1);
    expect(chips.some((c) => c.name === 'Grappling (Restrain)')).toBe(true);
    expect(chips.some((c) => c.name === 'Grappling (Pull)')).toBe(true);
  });

  it('Restrain chip adds Restrained condition to target', () => {
    const table = mockTable({
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const { chips } = runReviewAction(Grappling, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const restrainChip = chips.find((c) => c.name === 'Grappling (Restrain)');
    const mutations = activateChip(restrainChip, table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: expect.objectContaining({ condition: 'Restrained' }),
      })
    );
  });

  it('Pull chip queues a move mutation to Melee range', () => {
    const table = mockTable({
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const { chips } = runReviewAction(Grappling, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const pullChip = chips.find((c) => c.name === 'Grappling (Pull)');
    const mutations = activateChip(pullChip, table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({
          description: 'Pull target into Melee range',
        }),
      })
    );
  });

  it('does not show chips on failed attack', () => {
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
