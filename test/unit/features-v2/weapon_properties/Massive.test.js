import { describe, it, expect } from 'vitest';
import { Massive } from '../../../../src/features-v2/weapon_properties/Massive.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Massive', () => {
  it('has -1 Evasion passive stat mod', () => {
    expect(Massive.passiveStatMods).toEqual({ evasion: -1 });
  });

  it('adds bonus damage on a successful attack (extra die higher than lowest)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical' }];
    const { mutations } = runReviewAction(Massive, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
        effects,
      },
      rolls: mockRoll({ isSuccess: true, damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
      _rng: () => 6 / 8, // extra d8 rolls 7
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rollDie', payload: expect.objectContaining({ notation: 'd8' }) })
    );
    // Original amount was 5, extra roll is 7, lowest is 5 → bonus = 7 - 5 = 2
    expect(effects[0].amount).toBe(7);
  });

  it('adds no bonus when extra die is the lowest', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical' }];
    const { mutations } = runReviewAction(Massive, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
        effects,
      },
      rolls: mockRoll({ isSuccess: true, damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
      _rng: () => 0, // extra d8 rolls 1 (lowest)
    });

    // Original amount 5, extra roll 1, lowest is 1 → bonus = 1 - 1 = 0
    expect(effects[0].amount).toBe(5);
  });

  it('does not trigger on a failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical' }];
    runReviewAction(Massive, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
        effects,
      },
      rolls: mockRoll({ isSuccess: false, damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
      _rng: () => 6 / 8,
    });

    expect(effects[0].amount).toBe(5);
  });

  it('does not trigger on a successful non-attack action', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical' }];
    runReviewAction(Massive, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'trait', actorInstanceId: 'char-1' }),
        effects,
      },
      rolls: mockRoll({ isSuccess: true, damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
      _rng: () => 6 / 8,
    });

    expect(effects[0].amount).toBe(5);
  });
});
