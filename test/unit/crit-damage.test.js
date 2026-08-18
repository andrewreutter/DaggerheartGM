import { describe, it, expect } from 'vitest';
import {
  parseDiceExpr,
  maxDamageDiceValue,
} from '../../src/client/lib/dice-utils.js';
import {
  critExtraDamageFromSubItems,
  critExtraDamageForRoll,
} from '../../src/client/lib/crit-damage.js';
import {
  isAdversaryNatural20,
  isAttackCritical,
  isNatural20SubItem,
  rollBeatsDefense,
} from '../../src/client/lib/duality-roll-outcome.js';

describe('parseDiceExpr / maxDamageDiceValue', () => {
  it('parses qty, sides, and modifier', () => {
    expect(parseDiceExpr('2d8+5')).toMatchObject({ qty: 2, sides: 8, modifier: 5 });
    expect(parseDiceExpr('d12')).toMatchObject({ qty: 1, sides: 12, modifier: 0 });
    expect(parseDiceExpr('2d8kh')).toMatchObject({ qty: 2, sides: 8, keep: 'kh' });
  });

  it('maxDamageDiceValue excludes modifiers (2d8+5 → 16)', () => {
    expect(maxDamageDiceValue('2d8+5')).toBe(16);
    expect(maxDamageDiceValue('d8+2')).toBe(8);
    expect(maxDamageDiceValue('3d6')).toBe(18);
    expect(maxDamageDiceValue('2d8kh+3')).toBe(16);
    expect(maxDamageDiceValue('d8!')).toBe(8);
    expect(maxDamageDiceValue('5')).toBe(0);
    expect(maxDamageDiceValue(null)).toBe(0);
  });
});

describe('isAdversaryNatural20 / isAttackCritical', () => {
  const advNat20 = {
    _attackerType: 'adversary',
    total: 23,
    subItems: [
      { pre: 'Claw ', input: 'd20+3', result: '23', details: '(20)', post: '' },
      { pre: 'damage ', input: '2d8+5', result: '14', details: '(6+3)', post: ' phy' },
    ],
  };

  it('detects an adversary natural 20 from details', () => {
    expect(isNatural20SubItem(advNat20.subItems[0])).toBe(true);
    expect(isAdversaryNatural20(advNat20)).toBe(true);
    expect(isAttackCritical(advNat20)).toBe(true);
  });

  it('detects a natural 20 from result minus modifier when details are missing', () => {
    const roll = {
      subItems: [{ pre: 'Bite ', input: 'd20+2', result: '22', post: '' }],
    };
    expect(isAdversaryNatural20(roll)).toBe(true);
  });

  it('does not treat a total of 20 with a lower face as a crit', () => {
    const roll = {
      subItems: [{ pre: 'Bite ', input: 'd20+3', result: '20', details: '(17)', post: '' }],
    };
    expect(isAdversaryNatural20(roll)).toBe(false);
    expect(isAttackCritical(roll)).toBe(false);
  });

  it('does not treat a Duality roll as an adversary nat 20 even if a d20 is 20', () => {
    const roll = {
      dominant: 'hope',
      subItems: [
        { pre: 'Hope ', input: 'd12', result: '8', post: '' },
        { pre: 'Fear ', input: 'd12', result: '3', post: '' },
        { pre: 'Agility ', input: 'd20+3', result: '23', details: '(20)', post: '' },
      ],
    };
    expect(isAdversaryNatural20(roll)).toBe(false);
    expect(isAttackCritical(roll)).toBe(false);
  });

  it('treats Duality doubles as a critical', () => {
    expect(isAttackCritical({ dominant: 'critical' })).toBe(true);
    expect(isAdversaryNatural20({ dominant: 'critical' })).toBe(false);
  });
});

describe('rollBeatsDefense adversary nat 20', () => {
  it('always hits on a natural 20 even when the total is below evasion', () => {
    const roll = {
      total: 20,
      subItems: [{ pre: 'Claw ', input: 'd20', result: '20', details: '(20)', post: '' }],
    };
    expect(rollBeatsDefense(roll, 25, 20)).toBe(true);
  });
});

describe('critExtraDamageForRoll', () => {
  it('adds max dice (no modifiers) on a Duality critical: 2d8+5 → 16', () => {
    const roll = {
      dominant: 'critical',
      subItems: [
        { pre: 'Hope ', input: 'd12', result: '7', post: '' },
        { pre: 'Fear ', input: 'd12', result: '7', post: '' },
        { pre: 'damage ', input: '2d8+5', result: '14', details: '(6+3)', post: ' phy' },
      ],
    };
    expect(critExtraDamageFromSubItems(roll.subItems)).toBe(16);
    expect(critExtraDamageForRoll(roll)).toBe(16);
  });

  it('returns 0 when the roll is not a critical', () => {
    const roll = {
      dominant: 'hope',
      subItems: [{ pre: 'damage ', input: '2d8+5', result: '14', post: ' phy' }],
    };
    expect(critExtraDamageForRoll(roll)).toBe(0);
  });

  it('adds extra on an adversary natural 20', () => {
    const roll = {
      _attackerType: 'adversary',
      subItems: [
        { pre: 'Claw ', input: 'd20+3', result: '23', details: '(20)', post: '' },
        { pre: 'damage ', input: '1d12+2', result: '9', details: '(7)', post: ' phy' },
      ],
    };
    expect(critExtraDamageForRoll(roll)).toBe(12);
  });

  it('sums max dice across multiple damage sub-items', () => {
    const roll = {
      dominant: 'critical',
      subItems: [
        { pre: 'damage ', input: '2d8+5', result: '14', post: ' phy' },
        { pre: 'Kick 2d6 damage', input: '2d6', result: '8', post: '' },
      ],
    };
    expect(critExtraDamageForRoll(roll)).toBe(16 + 12);
  });

  it('ignores static integer damage with no dice', () => {
    const roll = {
      dominant: 'critical',
      subItems: [{ pre: 'damage ', input: '5', result: '5', post: '' }],
    };
    expect(critExtraDamageForRoll(roll)).toBe(0);
  });
});
