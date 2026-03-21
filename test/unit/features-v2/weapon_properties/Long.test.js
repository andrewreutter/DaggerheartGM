import { describe, it, expect } from 'vitest';
import { Long } from '../../../../src/features-v2/weapon_properties/Long.js';

describe('Long', () => {
  it('has the correct name', () => {
    expect(Long.name).toBe('Long');
  });

  it('is a narrative-only feature with no hooks or chips', () => {
    expect(Long.hooks).toBeUndefined();
    expect(Long.chips).toBeUndefined();
    expect(Long.passiveStatMods).toBeUndefined();
  });

  it('has a description matching the SRD text', () => {
    expect(Long.description).toContain('targets all adversaries in a line within range');
  });
});
