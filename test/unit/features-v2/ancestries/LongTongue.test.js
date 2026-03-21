import { describe, it, expect } from 'vitest';
import { LongTongue } from '../../../../src/features-v2/ancestries/Ribbet.js';

describe('Long Tongue', () => {
  it('provides a virtual weapon', () => {
    expect(LongTongue.virtualWeapons).toBeDefined();
    expect(LongTongue.virtualWeapons).toHaveLength(1);

    const weapon = LongTongue.virtualWeapons[0];
    expect(weapon.name).toBe('Long Tongue');
    expect(weapon.trait).toBe('finesse');
    expect(weapon.range).toBe('close');
    expect(weapon.damage).toBe('d12');
  });

  it('requires marking 1 Stress to use the weapon (stressCost on virtual weapon)', () => {
    const weapon = LongTongue.virtualWeapons[0];
    expect(weapon.stressCost).toBe(1);
  });

  it('does not use undocumented chips array on the virtual weapon', () => {
    const weapon = LongTongue.virtualWeapons[0];
    expect(weapon.chips).toBeUndefined();
  });
});
