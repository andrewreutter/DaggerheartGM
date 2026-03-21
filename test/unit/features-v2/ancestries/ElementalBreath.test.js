import { describe, it, expect } from 'vitest';
import { ElementalBreath } from '../../../../src/features-v2/ancestries/Drakona.js';

describe('ElementalBreath', () => {
  it('declares a virtual weapon with correct properties', () => {
    expect(ElementalBreath.virtualWeapons).toBeDefined();
    expect(ElementalBreath.virtualWeapons).toHaveLength(1);

    const weapon = ElementalBreath.virtualWeapons[0];
    expect(weapon.name).toBe('Elemental Breath');
    expect(weapon.trait).toBe('instinct');
    expect(weapon.range).toBe('veryClose');
    expect(weapon.damage).toBe('d8');
    expect(weapon.damageType).toBe('magic');
  });

  it('does not have hooks or chips (blocked: V2 API lacks multiTarget support for virtualWeapons)', () => {
    expect(ElementalBreath.hooks).toBeUndefined();
    expect(ElementalBreath.chips).toBeUndefined();
  });
});
