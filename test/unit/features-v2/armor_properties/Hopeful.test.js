import { describe, it, expect } from 'vitest';
import { Hopeful } from '../../../../src/features-v2/armor_properties/Hopeful.js';

describe('Hopeful', () => {
  it('has the correct name', () => {
    expect(Hopeful.name).toBe('Hopeful');
  });

  it('has a description', () => {
    expect(typeof Hopeful.description).toBe('string');
    expect(Hopeful.description.length).toBeGreaterThan(0);
  });

  it('declares substituteArmorForHope for merge onto the character element', () => {
    expect(Hopeful.substituteArmorForHope).toBe(true);
  });

  it('has no hooks or chips — substitution is via spendHope / deductChipCosts API', () => {
    expect(Hopeful.hooks).toBeUndefined();
    expect(Hopeful.chips).toBeUndefined();
    expect(Hopeful.passiveStatMods).toBeUndefined();
  });
});
