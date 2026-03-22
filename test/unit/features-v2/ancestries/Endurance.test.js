import { describe, it, expect } from 'vitest';
import { Endurance } from '../../../../src/features-v2/ancestries/Giant.js';

describe('Endurance', () => {
  it('is a passive stat mod feature', () => {
    expect(Endurance.name).toBe('Endurance');
    expect(Endurance.description).toBeDefined();
    expect(Endurance.passiveStatMods).toBeDefined();
    expect(Endurance.passiveStatMods.maxHP).toBe(1);
  });

  it('has no chips or hooks (purely declarative)', () => {
    expect(Endurance.chips).toBeUndefined();
    expect(Endurance.hooks).toBeUndefined();
  });
});
