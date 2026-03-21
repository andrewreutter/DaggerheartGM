import { describe, it, expect } from 'vitest';
import { Pompous } from '../../../../src/features-v2/weapon_properties/Pompous.js';

describe('Pompous', () => {
  it('has the correct name and description', () => {
    expect(Pompous.name).toBe('Pompous');
    expect(Pompous.description).toContain('Presence of 0 or lower');
  });

  it('has no hooks, chips, or passive stat mods (purely narrative)', () => {
    expect(Pompous.hooks).toBeUndefined();
    expect(Pompous.chips).toBeUndefined();
    expect(Pompous.passiveStatMods).toBeUndefined();
  });
});
