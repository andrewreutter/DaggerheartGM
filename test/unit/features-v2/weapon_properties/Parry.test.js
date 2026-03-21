import { describe, it, expect } from 'vitest';
import { Parry } from '../../../../src/features-v2/weapon_properties/Parry.js';
import { runReviewAction, mockCharacter, mockAdversary } from '../helpers.js';

const WID = 'w-parry';

function makeParryFeature() {
  return { ...Parry, _ownerInstanceId: 'char-1', _weaponId: WID };
}

describe('Parry', () => {
  it('reduces incoming damage when a parry die matches an attacker damage die face', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: WID, name: 'Parrying Dagger', damage: 'd8' }],
      primaryWeapon: { id: WID, name: 'Parrying Dagger', damage: 'd8' },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      {
        type: 'damage',
        target: char,
        amount: 12,
        source: adv,
        damageType: 'physical',
      },
    ];

    runReviewAction(makeParryFeature(), {
      _rng: () => 0.5,
      rolls: {
        action: { isSuccess: true, hopeDie: { value: 1 }, fearDie: { value: 2 } },
        damage: {
          dice: [{ name: 'weapon', die: 'd8', value: 5 }],
          statics: [],
        },
      },
      activeElements: [char, adv],
      action: {
        type: 'attack',
        actorInstanceId: adv.instanceId,
        targetInstanceIds: [char.instanceId],
        effects,
        appliedEffects: [],
      },
    });

    expect(effects[0].amount).toBe(7);
  });

  it('does not reduce damage when parry faces do not match any attacker die', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: WID, name: 'Parrying Dagger', damage: 'd8' }],
      primaryWeapon: { id: WID, name: 'Parrying Dagger', damage: 'd8' },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      {
        type: 'damage',
        target: char,
        amount: 12,
        source: adv,
        damageType: 'physical',
      },
    ];

    runReviewAction(makeParryFeature(), {
      _rng: () => 0,
      rolls: {
        action: { isSuccess: true, hopeDie: { value: 1 }, fearDie: { value: 2 } },
        damage: {
          dice: [{ name: 'weapon', die: 'd8', value: 5 }],
          statics: [],
        },
      },
      activeElements: [char, adv],
      action: {
        type: 'attack',
        actorInstanceId: adv.instanceId,
        targetInstanceIds: [char.instanceId],
        effects,
        appliedEffects: [],
      },
    });

    expect(effects[0].amount).toBe(12);
  });
});
