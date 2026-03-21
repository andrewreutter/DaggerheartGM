import { describe, it, expect } from 'vitest';
import { Long } from '../../../../src/features-v2/weapon_properties/Long.js';

describe('Long', () => {
  it('has the correct name and description', () => {
    expect(Long.name).toBe('Long');
    expect(Long.description).toBeDefined();
  });

  it('is a purely narrative feature with no mechanical hooks or chips', () => {
    expect(Long.hooks).toBeUndefined();
    expect(Long.chips).toBeUndefined();
    expect(Long.passiveStatMods).toBeUndefined();
  });
});
