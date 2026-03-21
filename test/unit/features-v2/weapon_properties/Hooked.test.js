import { describe, it, expect } from 'vitest';
import { Hooked } from '../../../../src/features-v2/weapon_properties/Hooked.js';
import { runReviewAction, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Hooked', () => {
  it('shows chip on a successful attack', () => {
    const { chips } = runReviewAction(Hooked, {
      action: mockAction({ type: 'attack' }),
      rolls: {
        action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [], isSuccess: true, isCritical: false },
        damage: { dice: [], statics: [] },
        other: {},
      },
    });

    expect(chips).toHaveLength(1);
    expect(chips[0].description).toBe('Pull the target into Melee range.');
  });

  it('queues a move mutation when chip is used', () => {
    const { chips, mutations } = runReviewAction(Hooked, {
      action: mockAction({ type: 'attack' }),
      rolls: {
        action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [], isSuccess: true, isCritical: false },
        damage: { dice: [], statics: [] },
        other: {},
      },
    });

    expect(chips).toHaveLength(1);
  });

  it('does not show chip on a failed attack', () => {
    const { chips } = runReviewAction(Hooked, {
      action: mockAction({ type: 'attack' }),
      rolls: {
        action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [], isSuccess: false, isCritical: false },
        damage: { dice: [], statics: [] },
        other: {},
      },
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show chip on a successful non-attack action', () => {
    const { chips } = runReviewAction(Hooked, {
      action: mockAction({ type: 'trait' }),
      rolls: {
        action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [], isSuccess: true, isCritical: false },
        damage: { dice: [], statics: [] },
        other: {},
      },
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show chip when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction({ ...Hooked, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: {
        action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [], isSuccess: true, isCritical: false },
        damage: { dice: [], statics: [] },
        other: {},
      },
    });

    expect(chips).toHaveLength(0);
  });
});
