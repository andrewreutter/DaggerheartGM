import { describe, it, expect } from 'vitest';
import { Unshakable } from '../../../../src/features-v2/ancestries/Firbolg.js';

describe('Unshakable', () => {
  it('has the correct name and description', () => {
    expect(Unshakable.name).toBe('Unshakable');
    expect(Unshakable.description).toMatch(/mark a Stress/i);
    expect(Unshakable.description).toMatch(/d6/i);
  });

  it('has no chips or hooks (blocked: V2 API lacks automatic dice rolling in hooks)', () => {
    expect(Unshakable.chips).toBeUndefined();
    expect(Unshakable.hooks).toBeUndefined();
    expect(Unshakable.passiveStatMods).toBeUndefined();
  });
});
