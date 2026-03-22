import { describe, it, expect } from 'vitest';
import { HighStamina } from '../../../../src/features-v2/ancestries/Human.js';

describe('High Stamina', () => {
  it('is a passive stat mod feature', () => {
    expect(HighStamina.name).toBe('High Stamina');
    expect(HighStamina.description).toBeDefined();
    expect(HighStamina.passiveStatMods).toBeDefined();
    expect(HighStamina.passiveStatMods.maxStress).toBe(1);
  });

  it('has no chips or hooks (purely declarative)', () => {
    expect(HighStamina.chips).toBeUndefined();
    expect(HighStamina.hooks).toBeUndefined();
  });
});
