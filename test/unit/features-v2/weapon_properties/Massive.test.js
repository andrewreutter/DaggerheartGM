import { describe, it, expect } from 'vitest';
import { Massive } from '../../../../src/features-v2/weapon_properties/Massive.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Massive', () => {
  it('has -1 evasion as a passive stat mod', () => {
    expect(Massive.passiveStatMods).toEqual({ evasion: -1 });
  });

  it('adds extra damage on successful attack when extra roll beats the minimum', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      { type: 'damage', target: adv, amount: 5, damageType: 'physical' },
    ];

    runReviewAction(Massive, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', effects }),
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
      }),
      _rng: () => 6 / 8, // d8: floor(6/8 * 8) + 1 = 7
    });

    // Original: [5], extra roll: 7, min(5,7)=5, bonus = 7-5 = 2
    expect(effects[0].amount).toBe(7);
  });

  it('adds zero when extra roll is the new minimum', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      { type: 'damage', target: adv, amount: 5, damageType: 'physical' },
    ];

    runReviewAction(Massive, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', effects }),
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
      }),
      _rng: () => 1 / 8, // d8: floor(1/8 * 8) + 1 = 2
    });

    // Original: [5], extra roll: 2, min(5,2)=2, bonus = 2-2 = 0
    expect(effects[0].amount).toBe(5);
  });

  it('does not trigger on failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      { type: 'damage', target: adv, amount: 5, damageType: 'physical' },
    ];

    runReviewAction(Massive, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', effects }),
      rolls: mockRoll({
        isSuccess: false,
        damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
      }),
      _rng: () => 6 / 8,
    });

    expect(effects[0].amount).toBe(5);
  });

  it('does not trigger on non-attack action', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      { type: 'damage', target: adv, amount: 5, damageType: 'physical' },
    ];

    runReviewAction(Massive, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1', effects }),
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
      }),
      _rng: () => 6 / 8,
    });

    expect(effects[0].amount).toBe(5);
  });

  it('does not trigger when not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      { type: 'damage', target: adv, amount: 5, damageType: 'physical' },
    ];

    runReviewAction({ ...Massive, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', effects }),
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
      }),
      _rng: () => 6 / 8,
    });

    expect(effects[0].amount).toBe(5);
  });
});
