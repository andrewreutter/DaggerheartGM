import { describe, it, expect } from 'vitest';
import { Parry } from '../../../../src/features-v2/weapon_properties/Parry.js';
import { runReviewAction, mockRoll, mockCharacter, mockAdversary } from '../helpers.js';

describe('Parry', () => {
  const charWithParryWeapon = (overrides = {}) =>
    mockCharacter({
      instanceId: 'char-1',
      weapons: [
        { id: 'w-parry', name: 'Parrying Dagger', tier: 1, range: 'melee', trait: 'finesse', damage: 'd6', features: ['Parry'] },
      ],
      ...overrides,
    });

  it('reduces damage when a parry die matches an attacker damage die', () => {
    const char = charWithParryWeapon();
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: char, amount: 10, damageType: 'physical', source: adv },
    ];

    runReviewAction(
      { ...Parry, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects,
        },
        rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 4 }] }),
        _rng: () => 3 / 6,
      }
    );

    expect(effects[0].amount).toBeLessThan(10);
  });

  it('does not reduce damage when parry die does not match any attacker die', () => {
    const char = charWithParryWeapon();
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: char, amount: 10, damageType: 'physical', source: adv },
    ];

    runReviewAction(
      { ...Parry, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects,
        },
        rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
        _rng: () => 0,
      }
    );

    expect(effects[0].amount).toBe(10);
  });

  it('does not trigger when the feature owner is not the target', () => {
    const char = charWithParryWeapon({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: other, amount: 10, damageType: 'physical', source: adv },
    ];

    runReviewAction(
      { ...Parry, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, other, adv],
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-2'],
          effects,
        },
        rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 4 }] }),
        _rng: () => 3 / 6,
      }
    );

    expect(effects[0].amount).toBe(10);
  });

  it('does not trigger when there is no damage effect', () => {
    const char = charWithParryWeapon();
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [];

    runReviewAction(
      { ...Parry, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects,
        },
        rolls: mockRoll({ damageDice: [] }),
        _rng: () => 3 / 6,
      }
    );

    expect(effects).toHaveLength(0);
  });
});
