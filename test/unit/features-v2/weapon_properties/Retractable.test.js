import { describe, it, expect } from 'vitest';
import { Retractable } from '../../../../src/features-v2/weapon_properties/Retractable.js';

describe('Retractable', () => {
  it('has the correct name', () => {
    expect(Retractable.name).toBe('Retractable');
  });

  it('has a description', () => {
    expect(typeof Retractable.description).toBe('string');
    expect(Retractable.description.length).toBeGreaterThan(0);
  });

  it('has no hooks or chips (purely narrative)', () => {
    expect(Retractable.hooks).toBeUndefined();
    expect(Retractable.chips).toBeUndefined();
    expect(Retractable.passiveStatMods).toBeUndefined();
  });
});
