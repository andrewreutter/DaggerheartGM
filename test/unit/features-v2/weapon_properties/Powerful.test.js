import { describe, it, expect } from 'vitest';
import { Powerful } from '../../../../src/features-v2/weapon_properties/Powerful.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Powerful', () => {
  it('adds an extra damage die and a negative static to discard the lowest on a successful attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(Powerful, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
      }),
      _rng: () => 2 / 8, // Extra die rolls 3
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Powerful',
          die: 'd8',
        }),
      })
    );

    const discardStatic = mutations.find(
      (m) =>
        m.type === 'addRollStatic' &&
        m.payload?.name === 'Powerful (discard lowest)'
    );
    expect(discardStatic).toBeDefined();
    expect(discardStatic.payload.value).toBeLessThan(0);
  });

  it('does not fire on a failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(Powerful, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({
        isSuccess: false,
        damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
      }),
    });

    const powerfulMuts = mutations.filter(
      (m) => m.payload?.name === 'Powerful' || m.payload?.name === 'Powerful (discard lowest)'
    );
    expect(powerfulMuts).toHaveLength(0);
  });

  it('does not fire on a non-attack action type', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(Powerful, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1' }),
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
      }),
    });

    const powerfulMuts = mutations.filter(
      (m) => m.payload?.name === 'Powerful' || m.payload?.name === 'Powerful (discard lowest)'
    );
    expect(powerfulMuts).toHaveLength(0);
  });

  it('does not fire when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(
      { ...Powerful, _ownerInstanceId: 'char-2' },
      {
        activeElements: [char, other, adv],
        action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
        rolls: mockRoll({
          isSuccess: true,
          damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
        }),
      }
    );

    const powerfulMuts = mutations.filter(
      (m) => m.payload?.name === 'Powerful' || m.payload?.name === 'Powerful (discard lowest)'
    );
    expect(powerfulMuts).toHaveLength(0);
  });

  it('discards the lowest value among all dice including the extra one', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    // Weapon die rolled 5, extra die will roll 3 → lowest is 3 → discard -3
    const { mutations } = runReviewAction(Powerful, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
      }),
      _rng: () => 2 / 8, // d8: floor(2/8 * 8) + 1 = 3
    });

    const discardStatic = mutations.find(
      (m) =>
        m.type === 'addRollStatic' &&
        m.payload?.name === 'Powerful (discard lowest)'
    );
    expect(discardStatic).toBeDefined();
    expect(discardStatic.payload.value).toBe(-3);
  });
});
