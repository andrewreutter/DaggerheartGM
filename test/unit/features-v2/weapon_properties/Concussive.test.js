import { describe, it, expect } from 'vitest';
import { Concussive } from '../../../../src/features-v2/weapon_properties/Concussive.js';
import { runReviewAction, mockRoll, mockAction, mockTable } from '../helpers.js';
import { activateChip } from '../../../../src/features-v2/engine/chip-system.js';

describe('Concussive', () => {
  it('shows chip on successful attack and queues move mutation', () => {
    const { chips } = runReviewAction(Concussive, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true })
    });

    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(1);

    const table = mockTable({
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true })
    });

    const mutations = activateChip(chips[0], table);
    
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({
          description: 'Knock target back to Far range'
        })
      })
    );
  });

  it('does not show chip on failed attack', () => {
    const { chips } = runReviewAction(Concussive, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false })
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show chip on successful non-attack action', () => {
    const { chips } = runReviewAction(Concussive, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: true })
    });

    expect(chips).toHaveLength(0);
  });
});
