import { describe, it, expect } from 'vitest';
import { Nimble } from '../../../../src/features-v2/ancestries/Simiah.js';

describe('Nimble', () => {
  it('provides +1 Evasion as a passive stat mod', () => {
    expect(Nimble.passiveStatMods).toBeDefined();
    expect(Nimble.passiveStatMods.evasion).toBe(1);
  });
});
