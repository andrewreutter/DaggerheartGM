import { describe, it, expect } from 'vitest';
import { Pompous } from '../../../../src/features-v2/weapon_properties/Pompous.js';

describe('Pompous', () => {
  it('has the correct name', () => {
    expect(Pompous.name).toBe('Pompous');
  });

  it('has no hooks, chips, or passiveStatMods (narrative only)', () => {
    expect(Pompous.hooks).toBeUndefined();
    expect(Pompous.chips).toBeUndefined();
    expect(Pompous.passiveStatMods).toBeUndefined();
  });

  it('has a description describing the weapon restriction', () => {
    expect(Pompous.description).toContain('Presence');
    expect(Pompous.description).toContain('0 or lower');
  });
});
