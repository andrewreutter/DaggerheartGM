import { describe, it, expect } from 'vitest';
import { Hooked } from '../../../../src/features-v2/weapon_properties/Hooked.js';
import { runReviewAction, mockRoll, mockAction, mockTable } from '../helpers.js';
import { activateChip } from '../../../../src/features-v2/engine/chip-system.js';

describe('Hooked', () => {
  it('shows chip on successful attack and queues move mutation', () => {
    const { chips } = runReviewAction(Hooked, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBeUndefined();

    const table = mockTable({
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

  it('does not trigger when the owner is not the acting character', () => {
    const { chips } = runReviewAction({ ...Hooked, _ownerInstanceId: 'char-2' }, {
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(0);
  });
});
