import { describe, it, expect } from 'vitest';
import { Powerful } from '../../../../src/features-v2/weapon_properties/Powerful.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

const WEP_ID = 'test-wep';
const testWeaponRow = { id: WEP_ID, name: 'Test', damage: 'd8', tier: 1, range: 'melee', trait: 'agility' };
const powerfulOnWeapon = {
  ...Powerful,
  _weaponId: WEP_ID,
  _source: 'weapon_property',
  _sourceObject: testWeaponRow,
};
function charWithTestWeapon(overrides = {}) {
  return mockCharacter({
    instanceId: 'char-1',
    weapons: [testWeaponRow],
    ...overrides,
  });
}

describe('Powerful', () => {
  it('on a successful attack, increases damage by max(weapon die, extra die) − weapon die', () => {
    const char = charWithTestWeapon();
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 4, damageType: 'physical', source: char }];
    runReviewAction(powerfulOnWeapon, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack' }),
        effects,
      },
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 4 }],
      }),
      _rng: () => 6 / 8,
    });

    expect(effects[0].amount).toBe(4 + (7 - 4));
  });

  it('does not change damage when the attack did not succeed', () => {
    const char = charWithTestWeapon();
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 4, damageType: 'physical', source: char }];
    runReviewAction(powerfulOnWeapon, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack' }),
        effects,
      },
      rolls: mockRoll({
        isSuccess: false,
        damageDice: [{ name: 'weapon', die: 'd8', value: 4 }],
      }),
    });

    expect(effects[0].amount).toBe(4);
  });

  it('does not apply to non-attack actions', () => {
    const char = charWithTestWeapon();
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 4, damageType: 'physical', source: char }];
    runReviewAction(powerfulOnWeapon, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'trait' }),
        effects,
      },
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 4 }],
      }),
      _rng: () => 6 / 8,
    });

    expect(effects[0].amount).toBe(4);
  });
});
