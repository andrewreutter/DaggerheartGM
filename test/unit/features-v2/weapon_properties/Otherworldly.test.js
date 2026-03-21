import { describe, it, expect } from 'vitest';
import { Otherworldly } from '../../../../src/features-v2/weapon_properties/Otherworldly.js';

describe('Otherworldly', () => {
  it('has the correct name and description', () => {
    expect(Otherworldly.name).toBe('Otherworldly');
    expect(Otherworldly.description).toBeDefined();
  });

  it('is a purely narrative feature with no mechanical hooks or chips', () => {
    expect(Otherworldly.hooks).toBeUndefined();
    expect(Otherworldly.chips).toBeUndefined();
    expect(Otherworldly.passiveStatMods).toBeUndefined();
  });
});
