import { describe, it, expect } from 'vitest';
import { Massive } from '../../../../src/features-v2/weapon_properties/Massive.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

const WEP_ID = 'test-wep';
const testWeaponRow = { id: WEP_ID, name: 'Test', damage: 'd8', tier: 1, range: 'melee', trait: 'agility' };
const massiveOnWeapon = {
  ...Massive,
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

describe('Massive', () => {
  it('applies -1 Evasion from passiveStatMods', () => {
    expect(Massive.passiveStatMods).toEqual({ evasion: -1 });
  });

  it('matches Powerful extra-die behavior on successful attacks', () => {
    const char = charWithTestWeapon();
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 3, damageType: 'physical', source: char }];
    runReviewAction(massiveOnWeapon, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack' }),
        effects,
      },
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 3 }],
      }),
      _rng: () => 7 / 8,
    });

    expect(effects[0].amount).toBe(3 + (8 - 3));
  });

  it('does not change damage when the attack did not succeed', () => {
    const char = charWithTestWeapon();
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 4, damageType: 'physical', source: char }];
    runReviewAction(massiveOnWeapon, {
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
    runReviewAction(massiveOnWeapon, {
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
