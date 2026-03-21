import { describe, it, expect } from 'vitest';
import { Powerful } from '../../../../src/features-v2/weapon_properties/Powerful.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

function makeAttackState({ rng, damageDiceValue = 3, dieNotation = 'd8' } = {}) {
  const char = mockCharacter({ instanceId: 'char-1' });
  const adv = mockAdversary({ instanceId: 'adv-1' });

  return {
    _rng: rng,
    activeElements: [char, adv],
    action: {
      ...mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      effects: [
        { type: 'damage', target: { instanceId: 'adv-1' }, amount: damageDiceValue, damageType: 'physical' },
      ],
    },
    rolls: mockRoll({
      isSuccess: true,
      damageDice: [{ name: 'weapon', die: dieNotation, value: damageDiceValue }],
    }),
  };
}

describe('Powerful', () => {
  it('rolls an extra damage die and increases damage when extra roll is higher than lowest', () => {
    const { mutations } = runReviewAction(Powerful, makeAttackState({
      rng: () => 6 / 8,
      damageDiceValue: 3,
      dieNotation: 'd8',
    }));

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rollDie' })
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'addNarration' })
    );
  });

  it('does not increase damage when extra roll is the lowest value', () => {
    const { mutations } = runReviewAction(Powerful, makeAttackState({
      rng: () => 0,
      damageDiceValue: 5,
      dieNotation: 'd8',
    }));

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rollDie' })
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'addNarration' })
    );
  });

  it('does not trigger when the attack fails', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(Powerful, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: false, damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
  });

  it('does not trigger on a non-attack action', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(Powerful, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
  });

  it('does not trigger when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction({ ...Powerful, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: true, damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
  });
});
