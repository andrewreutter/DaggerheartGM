import { describe, it, expect } from 'vitest';
import { Brave } from '../../../../src/features-v2/weapon_properties/Brave.js';

describe('Brave', () => {
  it('has correct passive stat mods', () => {
    expect(Brave.passiveStatMods).toEqual({
      evasion: -1,
      severeThreshold: 3
    });
  });
});
