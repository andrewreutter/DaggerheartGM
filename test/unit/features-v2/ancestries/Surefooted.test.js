import { describe, it, expect } from 'vitest';
import { Surefooted } from '../../../../src/features-v2/ancestries/Goblin.js';

describe('Surefooted', () => {
  it('is a feature with name and description', () => {
    expect(Surefooted.name).toBe('Surefooted');
    expect(Surefooted.description).toBeDefined();
    expect(typeof Surefooted.description).toBe('string');
  });

  it('is purely narrative (disadvantage removal requires engine support)', () => {
    // Note: Ignoring disadvantage on Agility Rolls requires engine support
    // that isn't available in the V2 API. This is a narrative feature.
    expect(Surefooted.chips).toBeUndefined();
    expect(Surefooted.hooks).toBeUndefined();
    expect(Surefooted.passiveStatMods).toBeUndefined();
  });
});
