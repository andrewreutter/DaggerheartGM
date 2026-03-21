import { describe, it, expect } from 'vitest';
import { Hooked } from '../../../../src/features-v2/weapon_properties/Hooked.js';
import { runReviewAction, mockRoll, mockAction, mockTable } from '../helpers.js';
import { activateChip } from '../../../../src/features-v2/engine/chip-system.js';

describe('Hooked', () => {
  it('shows a reviewAction chip on a successful attack and queues pull-to-melee move', () => {
    const { chips } = runReviewAction(Hooked, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(1);

    const table = mockTable({
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const mutations = activateChip(chips[0], table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({ description: 'Pull into Melee range' }),
      })
    );
  });

  it('does not show the chip when the attack fails', () => {
    const { chips } = runReviewAction(Hooked, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });
    expect(chips).toHaveLength(0);
  });

  it('does not show the chip on a successful non-attack action', () => {
    const { chips } = runReviewAction(Hooked, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: true }),
    });
    expect(chips).toHaveLength(0);
  });
});
