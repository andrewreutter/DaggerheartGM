import { describe, it, expect } from 'vitest';
import { Difficult } from '../../../../src/features-v2/armor_properties/Difficult.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';

describe('Difficult', () => {
  it('has the correct name matching the SRD', () => {
    expect(Difficult.name).toBe('Difficult');
  });

  it('declares -1 to all traits and evasion', () => {
    expect(Difficult.passiveStatMods).toEqual({
      evasion: -1,
      agility: -1,
      strength: -1,
      finesse: -1,
      instinct: -1,
      presence: -1,
      knowledge: -1,
    });
  });

  it('decreases evasion and all traits by 1 when applied via applyDeclarativeFeatures', () => {
    const character = {
      evasion: 12,
      traits: { agility: 2, strength: 2, finesse: 2, instinct: 2, presence: 2, knowledge: 2 },
    };
    const { stats } = applyDeclarativeFeatures([{ ...Difficult, _ownerInstanceId: 'c1' }], character, {});
    expect(stats.evasion).toBe(11);
    expect(stats.agility).toBe(1);
    expect(stats.strength).toBe(1);
    expect(stats.finesse).toBe(1);
    expect(stats.instinct).toBe(1);
    expect(stats.presence).toBe(1);
    expect(stats.knowledge).toBe(1);
  });

  it('does not modify thresholds or max stats', () => {
    const character = {
      evasion: 12,
      armorThresholds: { major: 7, severe: 14 },
      traits: { agility: 2, strength: 2, finesse: 2, instinct: 2, presence: 2, knowledge: 2 },
    };
    const { stats } = applyDeclarativeFeatures([{ ...Difficult, _ownerInstanceId: 'c1' }], character, {});
    expect(stats.majorThreshold).toBe(7);
    expect(stats.severeThreshold).toBe(14);
  });
});
