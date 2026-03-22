import { describe, it, expect } from 'vitest';
import { Heavy } from '../../../../src/features-v2/weapon_properties/Heavy.js';

describe('Heavy', () => {
  it('has correct passive stat mods', () => {
    expect(Heavy.passiveStatMods).toEqual({
      evasion: -1,
    });
  });

  it('does not grant any positive stat bonuses', () => {
    expect(Heavy.passiveStatMods.armorScore).toBeUndefined();
    expect(Heavy.passiveStatMods.severeThreshold).toBeUndefined();
  });
});
