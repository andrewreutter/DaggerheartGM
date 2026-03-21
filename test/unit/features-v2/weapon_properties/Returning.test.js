import { describe, it, expect } from 'vitest';
import { Returning } from '../../../../src/features-v2/weapon_properties/Returning.js';

describe('Returning', () => {
  it('has the correct name', () => {
    expect(Returning.name).toBe('Returning');
  });

  it('has a description', () => {
    expect(typeof Returning.description).toBe('string');
    expect(Returning.description.length).toBeGreaterThan(0);
  });

  it('has no hooks or chips (purely narrative)', () => {
    expect(Returning.hooks).toBeUndefined();
    expect(Returning.chips).toBeUndefined();
    expect(Returning.passiveStatMods).toBeUndefined();
  });
});
