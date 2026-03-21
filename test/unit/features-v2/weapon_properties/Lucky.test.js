import { describe, it, expect } from 'vitest';
import { Lucky } from '../../../../src/features-v2/weapon_properties/Lucky.js';
import { runReviewAction, mockRoll, mockAction, mockTable, mockCharacter, mockAdversary } from '../helpers.js';
import { activateChip } from '../../../../src/features-v2/engine/chip-system.js';

describe('Lucky', () => {
  it('shows chip on failed attack when acting', () => {
    const { chips } = runReviewAction(Lucky, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(chips).toHaveLength(1);
    expect(chips[0].stressCost).toBe(1);
  });

  it('rerolls both duality dice when chip is used', () => {
    const table = mockTable({
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    const { chips } = runReviewAction(Lucky, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    const mutations = activateChip(chips[0], table);

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rerollDie', payload: expect.objectContaining({ rollKey: 'action', dieType: 'hopeDie' }) })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rerollDie', payload: expect.objectContaining({ rollKey: 'action', dieType: 'fearDie' }) })
    );
  });

  it('does not show chip on successful attack', () => {
    const { chips } = runReviewAction(Lucky, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show chip on failed non-attack action', () => {
    const { chips } = runReviewAction(Lucky, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show chip when not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction({ ...Lucky, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(chips).toHaveLength(0);
  });
});
