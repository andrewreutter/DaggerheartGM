import { describe, it, expect } from 'vitest';
import { Lucky } from '../../../../src/features-v2/weapon_properties/Lucky.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary, mockTable, mockChipState } from '../helpers.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Lucky', () => {
  it('offers a reviewAction chip on a failed attack', () => {
    const { chips } = runReviewAction(Lucky, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(chips).toHaveLength(1);
    const chip = chips[0];
    expect(chip.stressCost).toBe(1);
    expect(chip.placements).toContain('reviewAction');
  });

  it('chip triggers action reroll when activated', () => {
    const { chips } = runReviewAction(Lucky, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    const table = mockTable({
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    chips[0].onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rerollDie', payload: { rollKey: 'action', dieType: 'hopeDie' } })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rerollDie', payload: { rollKey: 'action', dieType: 'fearDie' } })
    );
  });

  it('does not offer chip on a successful attack', () => {
    const { chips } = runReviewAction(Lucky, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not offer chip on a failed non-attack action', () => {
    const { chips } = runReviewAction(Lucky, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not offer chip when the feature owner is not the attacker', () => {
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
