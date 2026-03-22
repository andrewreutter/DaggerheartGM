import { describe, it, expect } from 'vitest';
import { CelestialTrance } from '../../../../src/features-v2/ancestries/Elf.js';

describe('Celestial Trance', () => {
  it('has the correct name and description', () => {
    expect(CelestialTrance.name).toBe('Celestial Trance');
    expect(CelestialTrance.description).toMatch(/additional downtime move/i);
  });

  it('declares extra rest slots via passiveStatMods (CONV-011)', () => {
    expect(CelestialTrance.passiveStatMods).toBeDefined();
    expect(CelestialTrance.passiveStatMods.numShortRestSlots).toBe(1);
    expect(CelestialTrance.passiveStatMods.numLongRestSlots).toBe(1);
  });

  it('has no hooks or chips (passive only)', () => {
    expect(CelestialTrance.hooks).toBeUndefined();
    expect(CelestialTrance.chips).toBeUndefined();
  });
});
