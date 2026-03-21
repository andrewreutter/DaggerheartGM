import { describe, it, expect } from 'vitest';
import { Long } from '../../../../src/features-v2/weapon_properties/Long.js';

describe('Long', () => {
  it('is a narrative-only feature with name and description', () => {
    expect(Long.name).toBe('Long');
    expect(Long.description).toBeDefined();
  });

  it('has no mechanical effects (no hooks, chips, or stat mods)', () => {
    expect(Long.hooks).toBeUndefined();
    expect(Long.chips).toBeUndefined();
    expect(Long.passiveStatMods).toBeUndefined();
  });
});
