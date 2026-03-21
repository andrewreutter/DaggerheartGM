import { describe, it, expect } from 'vitest';
import { Parry } from '../../../../src/features-v2/weapon_properties/Parry.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

function makeParryState({ rng, attackerDiceValue = 5, parryWeaponDamage = 'd6' } = {}) {
  const char = mockCharacter({
    instanceId: 'char-1',
    weapons: [{ id: 'w1', name: 'Parrying Dagger', damage: parryWeaponDamage, feature: ['Parry'] }],
  });
  const adv = mockAdversary({ instanceId: 'adv-1' });

  return {
    _rng: rng,
    activeElements: [char, adv],
    _ownerInstanceId: 'char-1',
    action: {
      ...mockAction({ type: 'attack', actorInstanceId: 'adv-1', targetInstanceIds: ['char-1'] }),
      effects: [
        { type: 'damage', target: { instanceId: 'char-1' }, amount: 10, damageType: 'physical' },
      ],
    },
    rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: attackerDiceValue }] }),
  };
}

describe('Parry', () => {
  it('rolls the parry die and queues a rollDie mutation when targeted by an attack', () => {
    const { mutations } = runReviewAction(Parry, makeParryState({
      rng: () => 4 / 6,
      attackerDiceValue: 5,
    }));

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rollDie' })
    );
  });

  it('adds narration when the parry die matches an attacker damage die', () => {
    const { mutations } = runReviewAction(Parry, makeParryState({
      rng: () => 4 / 6,
      attackerDiceValue: 5,
    }));

    const narrations = mutations.filter((m) => m.type === 'addNarration');
    expect(narrations.length).toBeGreaterThan(0);
  });

  it('does not trigger when the owner is not targeted (owner is the actor)', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: 'w1', name: 'Parrying Dagger', damage: 'd6', feature: ['Parry'] }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(Parry, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
  });

  it('does not trigger on non-attack actions', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: 'w1', name: 'Parrying Dagger', damage: 'd6', feature: ['Parry'] }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(Parry, {
      _ownerInstanceId: 'char-1',
      activeElements: [char, adv],
      action: mockAction({ type: 'trait', actorInstanceId: 'adv-1', targetInstanceIds: ['char-1'] }),
      actionType: 'trait',
      rolls: mockRoll(),
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
  });
});
