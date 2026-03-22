import { describe, it, expect } from 'vitest';
import { Versatile } from '../../../../src/features-v2/weapon_properties/Versatile.js';

describe('Versatile', () => {
  it('has the correct name', () => {
    expect(Versatile.name).toBe('Versatile');
  });

  it('has a description', () => {
    expect(typeof Versatile.description).toBe('string');
    expect(Versatile.description.length).toBeGreaterThan(0);
  });

  it('has no hooks or chips (alternate trait/range/damage comes from the weapon SRD entry; client shows amber alternate card)', () => {
    expect(Versatile.hooks).toBeUndefined();
    expect(Versatile.chips).toBeUndefined();
    expect(Versatile.passiveStatMods).toBeUndefined();
  });
});
