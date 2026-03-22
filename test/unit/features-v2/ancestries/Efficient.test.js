import { describe, it, expect } from 'vitest';
import { Efficient } from '../../../../src/features-v2/ancestries/Clank.js';

describe('Efficient', () => {
  it('has the correct name and description', () => {
    expect(Efficient.name).toBe('Efficient');
    expect(Efficient.description).toMatch(/short rest/i);
    expect(Efficient.description).toMatch(/long rest move/i);
  });

  it('allows a long-rest move during a short rest via passiveStatMods (CONV-011)', () => {
    expect(Efficient.passiveStatMods).toBeDefined();
    expect(Efficient.passiveStatMods.numLongMovesInShortRest).toBe(1);
  });

  it('has no chips or hooks (passive only)', () => {
    expect(Efficient.chips).toBeUndefined();
    expect(Efficient.hooks).toBeUndefined();
  });
});
