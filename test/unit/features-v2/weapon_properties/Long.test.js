import { describe, it, expect } from 'vitest';
import { Long } from '../../../../src/features-v2/weapon_properties/Long.js';

describe('Long', () => {
  it('has correct name and description', () => {
    expect(Long.name).toBe('Long');
    expect(Long.description).toContain('all adversaries in a line');
  });

  it('has no mechanical hooks or chips (narrative only)', () => {
    expect(Long.hooks).toBeUndefined();
    expect(Long.chips).toBeUndefined();
    expect(Long.passiveStatMods).toBeUndefined();
  });
});
