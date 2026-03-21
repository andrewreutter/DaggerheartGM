import { describe, it, expect } from 'vitest';
import { Reach } from '../../../../src/features-v2/ancestries/Giant.js';

describe('Reach', () => {
  it('is a feature with name and description', () => {
    expect(Reach.name).toBe('Reach');
    expect(Reach.description).toBeDefined();
    expect(typeof Reach.description).toBe('string');
  });

  it('is purely narrative (range modification requires engine support)', () => {
    // Note: Range modification from Melee to Very Close requires engine support
    // that isn't available in the V2 API. This is a narrative feature.
    expect(Reach.chips).toBeUndefined();
    expect(Reach.hooks).toBeUndefined();
    expect(Reach.passiveStatMods).toBeUndefined();
  });
});
