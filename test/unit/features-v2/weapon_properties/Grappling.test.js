import { describe, it, expect } from 'vitest';
import { Grappling } from '../../../../src/features-v2/weapon_properties/Grappling.js';
import { runReviewAction, mockRoll, mockAction, mockTable } from '../helpers.js';
import { activateChip } from '../../../../src/features-v2/engine/chip-system.js';

describe('Grappling', () => {
  it('shows two chips on a successful attack (Restrain and Pull)', () => {
    const { chips } = runReviewAction(Grappling, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(2);
    expect(chips[0].hopeCost).toBe(1);
    expect(chips[1].hopeCost).toBe(1);
  });

  it('Restrain chip queues addCondition mutation', () => {
    const { chips } = runReviewAction(Grappling, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const restrainChip = chips.find((c) => c.name === 'Grappling (Restrain)');
    expect(restrainChip).toBeDefined();

    const table = mockTable({
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const mutations = activateChip(restrainChip, table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: expect.objectContaining({ instanceId: 'adv-1', condition: 'Restrained' }),
      })
    );
  });

  it('Pull chip queues move mutation', () => {
    const { chips } = runReviewAction(Grappling, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const pullChip = chips.find((c) => c.name === 'Grappling (Pull)');
    expect(pullChip).toBeDefined();

    const table = mockTable({
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const mutations = activateChip(pullChip, table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({ description: 'Pull target into Melee range' }),
      })
    );
  });

  it('does not show chips on a failed attack', () => {
    const { chips } = runReviewAction(Grappling, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show chips on a successful non-attack action', () => {
    const { chips } = runReviewAction(Grappling, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(0);
  });
});
