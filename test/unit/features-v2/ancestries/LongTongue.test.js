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

  it('has a chip to mark stress for using the weapon', () => {
    const weapon = LongTongue.virtualWeapons[0];
    expect(weapon.chips).toBeDefined();
    expect(weapon.chips).toHaveLength(1);
    
    const chip = weapon.chips[0];
    expect(chip.stressCost).toBe(1);
    expect(chip.placements).toContain('card');
  });
});
