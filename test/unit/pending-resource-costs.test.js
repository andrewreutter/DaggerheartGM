import { describe, it, expect } from 'vitest';
import { reducePendingStressAfterManualMark } from '../../src/client/lib/pending-resource-costs.js';

describe('reducePendingStressAfterManualMark', () => {
  it('subtracts manual delta from pending stress and drops empty rows', () => {
    const prev = {
      a: { hope: 0, stress: 4, armorMark: 0, armorClear: 0 },
    };
    const next = reducePendingStressAfterManualMark(prev, 'a', 2);
    expect(next.a.stress).toBe(2);
  });

  it('removes instance entry when pending hits zero', () => {
    const prev = {
      a: { hope: 0, stress: 2, armorMark: 0, armorClear: 0 },
    };
    const next = reducePendingStressAfterManualMark(prev, 'a', 2);
    expect(next.a).toBeUndefined();
  });

  it('no-ops when delta is 0 or no pending stress', () => {
    expect(reducePendingStressAfterManualMark({}, 'x', 1)).toEqual({});
    const prev = { a: { hope: 1, stress: 0, armorMark: 0, armorClear: 0 } };
    expect(reducePendingStressAfterManualMark(prev, 'a', 2)).toBe(prev);
  });
});
