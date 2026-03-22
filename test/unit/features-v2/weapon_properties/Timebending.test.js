import { describe, it, expect } from 'vitest';
import { Timebending } from '../../../../src/features-v2/weapon_properties/Timebending.js';

describe('Timebending', () => {
  it('has the correct name', () => {
    expect(Timebending.name).toBe('Timebending');
  });

  it('has a description', () => {
    expect(typeof Timebending.description).toBe('string');
    expect(Timebending.description.length).toBeGreaterThan(0);
  });

  it('has no hooks or chips (target choice after roll is enforced by the Game Table UI)', () => {
    expect(Timebending.hooks).toBeUndefined();
    expect(Timebending.chips).toBeUndefined();
    expect(Timebending.passiveStatMods).toBeUndefined();
  });
});
