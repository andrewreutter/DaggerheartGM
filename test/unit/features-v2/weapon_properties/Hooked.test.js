import { describe, it, expect } from 'vitest';
import { Hooked } from '../../../../src/features-v2/weapon_properties/Hooked.js';
import { runReviewAction, mockRoll, mockAction, mockTable } from '../helpers.js';
import { activateChip } from '../../../../src/features-v2/engine/chip-system.js';

describe('Hooked', () => {
  it('shows a chip on a successful attack and queues move mutation', () => {
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
        payload: expect.objectContaining({ description: 'Pull target into Melee range' }),
      })
    );
  });

  it('does not show a chip on a failed attack', () => {
    const { chips } = runReviewAction(Hooked, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show a chip on a successful non-attack action', () => {
    const { chips } = runReviewAction(Hooked, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show a chip when the feature owner is not acting', () => {
    const char1 = { instanceId: 'char-1', elementType: 'character', name: 'C1', currentHp: 4, maxHp: 6, currentStress: 0, maxStress: 6, hope: 3, maxHope: 6, currentArmor: 0, maxArmor: 0, conditions: [], traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0 }, tokenX: null, tokenY: null };
    const char2 = { ...char1, instanceId: 'char-2', name: 'C2' };
    const adv = { instanceId: 'adv-1', elementType: 'adversary', name: 'A1', currentHp: 3, maxHp: 3, currentStress: 0, maxStress: 0, conditions: [], tokenX: null, tokenY: null };

    const { chips } = runReviewAction({ ...Hooked, _ownerInstanceId: 'char-2' }, {
      activeElements: [char1, char2, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(0);
  });
});
