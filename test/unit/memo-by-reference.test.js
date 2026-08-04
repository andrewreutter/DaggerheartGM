import { describe, it, expect, vi } from 'vitest';
import { computeWithRefCache } from '../../src/client/lib/memo-by-reference.js';

function makeState() {
  return { globalDeps: null, byRef: null };
}

describe('computeWithRefCache', () => {
  it('calls computeFn for every element on the first invocation', () => {
    const state = makeState();
    const compute = vi.fn((el) => ({ display: el.name }));
    const elA = { instanceId: 'a', name: 'PC-A' };
    const elB = { instanceId: 'b', name: 'PC-B' };

    const result = computeWithRefCache(state, [elA, elB], ['srd', 0, {}], compute);
    expect(compute).toHaveBeenCalledTimes(2);
    expect(result.get('a')).toEqual({ display: 'PC-A' });
    expect(result.get('b')).toEqual({ display: 'PC-B' });
  });

  it('reuses cached results for unchanged element references (same globalDeps)', () => {
    const state = makeState();
    const compute = vi.fn((el) => ({ display: el.name }));
    const elA = { instanceId: 'a', name: 'PC-A' };
    const elB = { instanceId: 'b', name: 'PC-B' };
    const globalDeps = ['srd', 0, {}];

    computeWithRefCache(state, [elA, elB], globalDeps, compute);
    compute.mockClear();

    // Same element references, same globalDeps references
    const result2 = computeWithRefCache(state, [elA, elB], globalDeps, compute);
    expect(compute).not.toHaveBeenCalled();
    expect(result2.get('a')).toEqual({ display: 'PC-A' });
    expect(result2.get('b')).toEqual({ display: 'PC-B' });
  });

  it('recomputes only the element whose reference changed', () => {
    const state = makeState();
    const compute = vi.fn((el) => ({ display: el.name }));
    const elA = { instanceId: 'a', name: 'PC-A' };
    const elB = { instanceId: 'b', name: 'PC-B' };
    const globalDeps = ['srd', 0, {}];

    computeWithRefCache(state, [elA, elB], globalDeps, compute);
    compute.mockClear();

    // elA is a new reference (its data changed), elB is the same reference
    const elANew = { instanceId: 'a', name: 'PC-A-Updated' };
    const result2 = computeWithRefCache(state, [elANew, elB], globalDeps, compute);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(compute).toHaveBeenCalledWith(elANew);
    expect(result2.get('a')).toEqual({ display: 'PC-A-Updated' });
    expect(result2.get('b')).toEqual({ display: 'PC-B' });
  });

  it('recomputes everything when a global dep changes (by reference)', () => {
    const state = makeState();
    const compute = vi.fn((el) => ({ display: el.name }));
    const elA = { instanceId: 'a', name: 'PC-A' };
    const srdV1 = { classes: [] };
    const srdV2 = { classes: ['bard'] }; // new reference

    computeWithRefCache(state, [elA], [srdV1, 0], compute);
    compute.mockClear();

    computeWithRefCache(state, [elA], [srdV2, 0], compute);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('does NOT recompute when global dep value is the same reference (even if content looks different)', () => {
    const state = makeState();
    const compute = vi.fn((el) => el.name);
    const el = { instanceId: 'a', name: 'PC' };
    const sharedSrd = { classes: [] };

    computeWithRefCache(state, [el], [sharedSrd, 2], compute);
    compute.mockClear();

    // Same sharedSrd reference, same 2 — no change
    computeWithRefCache(state, [el], [sharedSrd, 2], compute);
    expect(compute).not.toHaveBeenCalled();
  });

  it('drops removed elements from cache (no memory leak)', () => {
    const state = makeState();
    const compute = vi.fn((el) => ({ display: el.name }));
    const elA = { instanceId: 'a', name: 'PC-A' };
    const elB = { instanceId: 'b', name: 'PC-B' };
    const globalDeps = ['srd'];

    computeWithRefCache(state, [elA, elB], globalDeps, compute);
    compute.mockClear();

    // elB removed from table
    const result2 = computeWithRefCache(state, [elA], globalDeps, compute);
    expect(result2.has('b')).toBe(false);
    // The internal byRef cache should only contain elA
    expect(state.byRef.size).toBe(1);
    expect(state.byRef.has(elA)).toBe(true);
    expect(state.byRef.has(elB)).toBe(false);
  });

  it('handles an empty elements array', () => {
    const state = makeState();
    const compute = vi.fn();
    const result = computeWithRefCache(state, [], ['srd'], compute);
    expect(compute).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  it('recomputes when global deps length changes', () => {
    const state = makeState();
    const compute = vi.fn((el) => el.name);
    const el = { instanceId: 'a', name: 'PC' };
    const srd = {};

    computeWithRefCache(state, [el], [srd], compute);
    compute.mockClear();

    // Add a new global dep slot
    computeWithRefCache(state, [el], [srd, 0], compute);
    expect(compute).toHaveBeenCalledTimes(1);
  });
});
