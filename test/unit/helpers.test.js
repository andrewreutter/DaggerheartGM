import { describe, it, expect } from 'vitest';
import { isAdversaryDefeated } from '../../src/client/lib/helpers.js';

describe('isAdversaryDefeated', () => {
  it('returns true when hp_max > 0 and currentHp <= 0', () => {
    expect(isAdversaryDefeated({ hp_max: 6, currentHp: 0 })).toBe(true);
    expect(isAdversaryDefeated({ hp_max: 1, currentHp: 0 })).toBe(true);
  });

  it('returns false when currentHp > 0', () => {
    expect(isAdversaryDefeated({ hp_max: 6, currentHp: 1 })).toBe(false);
    expect(isAdversaryDefeated({ hp_max: 6, currentHp: 6 })).toBe(false);
  });

  it('returns false when hp_max is 0 (no HP track)', () => {
    expect(isAdversaryDefeated({ hp_max: 0, currentHp: 0 })).toBe(false);
  });

  it('defaults currentHp to hp_max when omitted', () => {
    expect(isAdversaryDefeated({ hp_max: 6 })).toBe(false);
    expect(isAdversaryDefeated({ hp_max: 0 })).toBe(false);
  });
});
