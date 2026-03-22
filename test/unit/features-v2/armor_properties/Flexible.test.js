import { describe, it, expect } from 'vitest';
import { Flexible } from '../../../../src/features-v2/armor_properties/Flexible.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';

describe('Flexible', () => {
  it('has the correct name matching the SRD', () => {
    expect(Flexible.name).toBe('Flexible');
  });

  it('declares +1 evasion passive stat mod', () => {
    expect(Flexible.passiveStatMods).toEqual({ evasion: 1 });
  });

  it('increases evasion by 1 when applied via applyDeclarativeFeatures', () => {
    const character = { evasion: 12, traits: {} };
    const { stats } = applyDeclarativeFeatures([{ ...Flexible, _ownerInstanceId: 'c1' }], character, {});
    expect(stats.evasion).toBe(13);
  });

  it('does not modify traits when applied', () => {
    const character = { evasion: 12, traits: { agility: 2, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0 } };
    const { stats } = applyDeclarativeFeatures([{ ...Flexible, _ownerInstanceId: 'c1' }], character, {});
    expect(stats.agility).toBe(2);
    expect(stats.strength).toBe(1);
    expect(stats.finesse).toBe(0);
  });
});
