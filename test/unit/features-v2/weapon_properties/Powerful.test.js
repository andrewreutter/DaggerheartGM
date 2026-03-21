import { describe, it, expect } from 'vitest';
import { Powerful } from '../../../../src/features-v2/weapon_properties/Powerful.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Powerful', () => {
  it('increases damage when extra die rolls higher than original', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 3, damageType: 'physical', source: char },
    ];

    runReviewAction(Powerful, {
      activeElements: [char, adv],
      action: { ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }), effects },
      rolls: mockRoll({ isSuccess: true, damageDice: [{ name: 'weapon', die: 'd8', value: 3 }] }),
      _rng: () => 6 / 8, // d8 → ceil((6/8)*8) = 7 → extra roll is 7, original is 3
    });

    expect(effects[0].amount).toBe(7);
  });

  it('does not change damage when extra die rolls lower than original', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 7, damageType: 'physical', source: char },
    ];

    runReviewAction(Powerful, {
      activeElements: [char, adv],
      action: { ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }), effects },
      rolls: mockRoll({ isSuccess: true, damageDice: [{ name: 'weapon', die: 'd8', value: 7 }] }),
      _rng: () => 2 / 8, // d8 → ceil((2/8)*8) = 3 → extra roll is 3, lower than 7
    });

    expect(effects[0].amount).toBe(7);
  });

  it('does not trigger on a failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 3, damageType: 'physical', source: char },
    ];

    runReviewAction(Powerful, {
      activeElements: [char, adv],
      action: { ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }), effects },
      rolls: mockRoll({ isSuccess: false, damageDice: [{ name: 'weapon', die: 'd8', value: 3 }] }),
      _rng: () => 6 / 8,
    });

    expect(effects[0].amount).toBe(3);
  });

  it('does not trigger on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 3, damageType: 'physical', source: char },
    ];

    runReviewAction(Powerful, {
      activeElements: [char, adv],
      action: { ...mockAction({ type: 'trait', actorInstanceId: 'char-1' }), effects },
      rolls: mockRoll({ isSuccess: true, damageDice: [{ name: 'weapon', die: 'd8', value: 3 }] }),
      _rng: () => 6 / 8,
    });

    expect(effects[0].amount).toBe(3);
  });

  it('does not trigger when the owner is not the attacker', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 3, damageType: 'physical', source: char },
    ];

    runReviewAction(
      { ...Powerful, _ownerInstanceId: 'char-2' },
      {
        activeElements: [char, other, adv],
        action: { ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }), effects },
        rolls: mockRoll({ isSuccess: true, damageDice: [{ name: 'weapon', die: 'd8', value: 3 }] }),
        _rng: () => 6 / 8,
      }
    );

    expect(effects[0].amount).toBe(3);
  });
});
