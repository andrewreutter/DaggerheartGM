import { describe, it, expect } from 'vitest';
import { Truthseeking } from '../../../../src/features-v2/armor_properties/Truthseeking.js';

describe('Truthseeking', () => {
  it('has the correct name', () => {
    expect(Truthseeking.name).toBe('Truthseeking');
  });

  it('has a description', () => {
    expect(typeof Truthseeking.description).toBe('string');
    expect(Truthseeking.description.length).toBeGreaterThan(0);
  });

  it('has no mechanical hooks or chips', () => {
    expect(Truthseeking.hooks).toBeUndefined();
    expect(Truthseeking.chips).toBeUndefined();
    expect(Truthseeking.passiveStatMods).toBeUndefined();
  });
});
