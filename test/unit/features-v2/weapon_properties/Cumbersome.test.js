import { describe, it, expect } from 'vitest';
import { Cumbersome } from '../../../../src/features-v2/weapon_properties/Cumbersome.js';

describe('Cumbersome', () => {
  it('has correct passive stat mods', () => {
    expect(Cumbersome.passiveStatMods).toEqual({
      finesse: -1
    });
  });
});
