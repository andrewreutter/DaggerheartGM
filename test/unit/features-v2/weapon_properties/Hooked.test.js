import { describe, it, expect } from 'vitest';
import { Hooked } from '../../../../src/features-v2/weapon_properties/Hooked.js';
import { runReviewAction, mockRoll, mockAction, mockTable } from '../helpers.js';
import { activateChip } from '../../../../src/features-v2/engine/chip-system.js';

describe('Hooked', () => {
  it('shows chip on successful attack', () => {
    const { chips } = runReviewAction(Hooked, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(1);
    expect(chips[0].description).toBe('Pull the target into Melee range.');
  });

  it('chip has no cost (free action)', () => {
    const { chips } = runReviewAction(Hooked, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips[0].hopeCost).toBeUndefined();
    expect(chips[0].stressCost).toBeUndefined();
  });

  it('chip queues a move mutation to Melee range', () => {
    const table = mockTable({
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const { chips } = runReviewAction(Hooked, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const mutations = activateChip(chips[0], table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({
          description: 'Pull target into Melee range',
        }),
      })
    );
  });

  it('does not show chip on failed attack', () => {
    const { chips } = runReviewAction(Hooked, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show chip on non-attack actions', () => {
    const { chips } = runReviewAction(Hooked, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(0);
  });
});
