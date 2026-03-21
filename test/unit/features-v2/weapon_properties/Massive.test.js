import { describe, it, expect } from 'vitest';
import { Massive } from '../../../../src/features-v2/weapon_properties/Massive.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Massive', () => {
  it('has passive stat mod of -1 Evasion', () => {
    expect(Massive.passiveStatMods).toEqual({ evasion: -1 });
  });

  it('adds extra damage (keeps highest) on a successful attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    // Weapon die d8 rolls 5; extra d8 rolls 7 (via _rng → 6/8 → face = floor(6/8*8)+1 = 7)
    // Lowest = 5 (original), net change = 7 - 5 = +2
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical', source: char },
    ];
    const { mutations } = runReviewAction(Massive, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack' }),
        effects,
      },
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
      }),
      _rng: () => 6 / 8,
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rollDie', payload: expect.objectContaining({ notation: 'd8' }) })
    );
    // 5 + (7 - 5) = 7
    expect(effects[0].amount).toBe(7);
  });

  it('adds zero when extra die is lower than original', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    // Weapon die d8 rolls 7; extra d8 rolls 3 (via _rng → 2/8 → face = floor(2/8*8)+1 = 3)
    // Extra is lowest → discard extra → net change = 0
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 7, damageType: 'physical', source: char },
    ];
    runReviewAction(Massive, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack' }),
        effects,
      },
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 7 }],
      }),
      _rng: () => 2 / 8,
    });

    expect(effects[0].amount).toBe(7);
  });

  it('does not add extra damage when attack fails', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical', source: char },
    ];
    const { mutations } = runReviewAction(Massive, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack' }),
        effects,
      },
      rolls: mockRoll({
        isSuccess: false,
        damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
      }),
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
    expect(effects[0].amount).toBe(5);
  });

  it('does not trigger when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical', source: char },
    ];
    const { mutations } = runReviewAction({ ...Massive, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
        effects,
      },
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
      }),
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
    expect(effects[0].amount).toBe(5);
  });

  it('does not trigger on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical', source: char },
    ];
    const { mutations } = runReviewAction(Massive, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'trait' }),
        effects,
      },
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
      }),
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
    expect(effects[0].amount).toBe(5);
  });
});
