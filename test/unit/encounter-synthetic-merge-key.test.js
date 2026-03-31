import { describe, it, expect } from 'vitest';
import { syntheticAdversaryMergeKey } from '../../src/encounter-plan-resolve.js';

describe('syntheticAdversaryMergeKey', () => {
  it('matches mergeSyntheticAdversaryRows grouping (concept||tier||role)', () => {
    const a = { concept: 'sewer ambush', tier: 2, role: 'standard' };
    const b = { concept: 'sewer ambush', tier: 2, role: 'standard', count: 3 };
    expect(syntheticAdversaryMergeKey(a)).toBe(syntheticAdversaryMergeKey(b));
  });

  it('normalizes role', () => {
    const k1 = syntheticAdversaryMergeKey({ concept: 'x', tier: 1, role: 'Standard' });
    const k2 = syntheticAdversaryMergeKey({ concept: 'x', tier: 1, role: 'standard' });
    expect(k1).toBe(k2);
  });
});
