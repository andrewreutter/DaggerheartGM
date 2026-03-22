import { describe, it, expect } from 'vitest';
import { Gilded } from '../../../../src/features-v2/armor_properties/Gilded.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';

describe('Gilded', () => {
  it('has the correct name matching the SRD', () => {
    expect(Gilded.name).toBe('Gilded');
  });

  it('declares +1 presence passive stat mod', () => {
    expect(Gilded.passiveStatMods).toEqual({ presence: 1 });
  });

  it('increases presence by 1 when applied via applyDeclarativeFeatures', () => {
    const character = { traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 2, knowledge: 0 } };
    const { stats } = applyDeclarativeFeatures([{ ...Gilded, _ownerInstanceId: 'c1' }], character, {});
    expect(stats.presence).toBe(3);
  });

  it('does not modify evasion or other traits when applied', () => {
    const character = { evasion: 12, traits: { agility: 1, strength: 0, finesse: 0, instinct: 0, presence: 2, knowledge: 0 } };
    const { stats } = applyDeclarativeFeatures([{ ...Gilded, _ownerInstanceId: 'c1' }], character, {});
    expect(stats.evasion).toBe(12);
    expect(stats.agility).toBe(1);
    expect(stats.knowledge).toBe(0);
  });
});
