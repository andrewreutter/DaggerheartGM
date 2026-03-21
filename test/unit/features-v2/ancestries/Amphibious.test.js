import { describe, it, expect } from 'vitest';
import { Amphibious } from '../../../../src/features-v2/ancestries/Ribbet.js';

describe('Amphibious', () => {
  it('is a purely narrative feature with no mechanical effect', () => {
    expect(Amphibious.name).toBe('Amphibious');
    expect(Amphibious.description).toBeDefined();
    expect(Amphibious.chips).toBeUndefined();
    expect(Amphibious.hooks).toBeUndefined();
    expect(Amphibious.passiveStatMods).toBeUndefined();
  });
});
