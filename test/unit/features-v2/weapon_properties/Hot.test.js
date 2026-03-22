import { describe, it, expect } from 'vitest';
import { Hot } from '../../../../src/features-v2/weapon_properties/Hot.js';

describe('Hot', () => {
  it('has the correct name', () => {
    expect(Hot.name).toBe('Hot');
  });

  it('has a description', () => {
    expect(typeof Hot.description).toBe('string');
    expect(Hot.description.length).toBeGreaterThan(0);
  });

  it('has no hooks or chips (purely narrative)', () => {
    expect(Hot.hooks).toBeUndefined();
    expect(Hot.chips).toBeUndefined();
    expect(Hot.passiveStatMods).toBeUndefined();
  });
});
