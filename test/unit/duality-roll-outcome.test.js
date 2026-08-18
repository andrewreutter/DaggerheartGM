import { describe, it, expect } from 'vitest';
import {
  isDualityCritical,
  isSuccessWithHope,
  effectiveDualityTotal,
  rollBeatsDefense,
} from '../../src/client/lib/duality-roll-outcome.js';
import { wrapRoll } from '../../src/client/lib/table-entity-roll.js';

describe('isDualityCritical / isSuccessWithHope', () => {
  it('treats matching dice as Critical, which is a success with Hope', () => {
    expect(isDualityCritical({ dominant: 'critical' })).toBe(true);
    expect(isSuccessWithHope({ dominant: 'critical' })).toBe(true);
    expect(isSuccessWithHope({ dominant: 'hope' })).toBe(true);
    expect(isSuccessWithHope({ dominant: 'fear' })).toBe(false);
    expect(isDualityCritical({ dominant: 'hope' })).toBe(false);
  });
});

describe('rollBeatsDefense', () => {
  it('always succeeds on Critical, even when the total is below the DC', () => {
    expect(rollBeatsDefense({ dominant: 'critical', total: 6 }, 18)).toBe(true);
    expect(rollBeatsDefense({ dominant: 'hope', total: 6 }, 18)).toBe(false);
    expect(rollBeatsDefense({ dominant: 'hope', total: 18 }, 18)).toBe(true);
  });

  it('always succeeds on an adversary natural 20 below evasion', () => {
    const roll = {
      total: 20,
      subItems: [{ pre: 'Claw ', input: 'd20', result: '20', details: '(20)', post: '' }],
    };
    expect(rollBeatsDefense(roll, 25)).toBe(true);
  });

  it('uses an explicit effective total when provided', () => {
    expect(rollBeatsDefense({ dominant: 'fear', total: 10 }, 14, 14)).toBe(true);
    expect(rollBeatsDefense({ dominant: 'fear', total: 10 }, 14)).toBe(false);
  });
});

describe('effectiveDualityTotal', () => {
  it('adds a selected Prayer Die on Duality rolls', () => {
    expect(effectiveDualityTotal({ total: 12, dominant: 'hope', _prayerAddRollDie: { value: 3 } })).toBe(15);
    expect(effectiveDualityTotal({ total: 12 })).toBe(12);
  });
});

describe('wrapRoll Critical', () => {
  it('exposes Critical as success with Hope, never failure', () => {
    const wrapped = wrapRoll({
      dominant: 'critical',
      total: 8,
      _difficulty: 15,
      isSuccess: false,
      subItems: [],
    });
    expect(wrapped.isWithHope).toBe(true);
    expect(wrapped.isWithFear).toBe(false);
    expect(wrapped.isSuccess).toBe(true);
    expect(wrapped.isFailure).toBe(false);
  });

  it('exposes adversary natural 20 as success, never failure', () => {
    const wrapped = wrapRoll({
      total: 20,
      isSuccess: false,
      subItems: [{ pre: 'Claw ', input: 'd20', result: '20', details: '(20)', post: '' }],
    });
    expect(wrapped.isSuccess).toBe(true);
    expect(wrapped.isFailure).toBe(false);
  });
});
