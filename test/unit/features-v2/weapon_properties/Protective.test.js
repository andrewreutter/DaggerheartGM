import { describe, it, expect } from 'vitest';
import { Protective } from '../../../../src/features-v2/weapon_properties/Protective.js';

describe('Protective', () => {
  it('has correct passive stat mods', () => {
    expect(Protective.passiveStatMods).toEqual({
      armorScore: 1,
    });
  });

  it('does not modify evasion or thresholds', () => {
    expect(Protective.passiveStatMods.evasion).toBeUndefined();
    expect(Protective.passiveStatMods.severeThreshold).toBeUndefined();
  });
});
