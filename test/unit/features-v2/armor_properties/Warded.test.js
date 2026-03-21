import { describe, it, expect } from 'vitest';
import { Warded } from '../../../../src/features-v2/armor_properties/Warded.js';

describe('Warded', () => {
  it('has the correct name', () => {
    expect(Warded.name).toBe('Warded');
  });

  it('has a description', () => {
    expect(typeof Warded.description).toBe('string');
    expect(Warded.description.length).toBeGreaterThan(0);
  });

  it('has no hooks (blocked — API does not expose armorScore on actor)', () => {
    expect(Warded.hooks).toBeUndefined();
  });
});
