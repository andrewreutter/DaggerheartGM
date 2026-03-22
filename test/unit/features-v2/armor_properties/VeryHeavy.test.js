import { describe, it, expect } from 'vitest';
import { VeryHeavy } from '../../../../src/features-v2/armor_properties/VeryHeavy.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';

describe('Very Heavy', () => {
  it('has the correct name matching the SRD', () => {
    expect(VeryHeavy.name).toBe('Very Heavy');
  });

  it('declares -2 evasion and -1 agility passive stat mods', () => {
    expect(VeryHeavy.passiveStatMods).toEqual({ evasion: -2, agility: -1 });
  });

  it('decreases evasion by 2 and agility by 1 when applied via applyDeclarativeFeatures', () => {
    const character = { evasion: 14, traits: { agility: 3, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0 } };
    const { stats } = applyDeclarativeFeatures([{ ...VeryHeavy, _ownerInstanceId: 'c1' }], character, {});
    expect(stats.evasion).toBe(12);
    expect(stats.agility).toBe(2);
  });

  it('does not modify other traits when applied', () => {
    const character = { evasion: 14, traits: { agility: 3, strength: 2, finesse: 1, instinct: 0, presence: 0, knowledge: 0 } };
    const { stats } = applyDeclarativeFeatures([{ ...VeryHeavy, _ownerInstanceId: 'c1' }], character, {});
    expect(stats.strength).toBe(2);
    expect(stats.finesse).toBe(1);
  });
});
