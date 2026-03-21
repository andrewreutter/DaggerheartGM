import { describe, it, expect } from 'vitest';
import { Pompous } from '../../../../src/features-v2/weapon_properties/Pompous.js';

describe('Pompous', () => {
  it('has the correct name', () => {
    expect(Pompous.name).toBe('Pompous');
  });

  it('has a description about Presence requirement', () => {
    expect(Pompous.description).toContain('Presence of 0 or lower');
  });

  it('has no hooks (purely narrative)', () => {
    expect(Pompous.hooks).toBeUndefined();
  });

  it('has no chips (purely narrative)', () => {
    expect(Pompous.chips).toBeUndefined();
  });

  it('has no passiveStatMods (purely narrative)', () => {
    expect(Pompous.passiveStatMods).toBeUndefined();
  });
});
