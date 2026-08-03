import { describe, it, expect } from 'vitest';
import { reconcileElementsById } from '../../src/client/lib/reconcile-active-elements.js';

describe('reconcileElementsById', () => {
  it('returns nextElements unchanged when prevElements is empty/absent', () => {
    const next = [{ instanceId: 'a', foo: 1 }];
    expect(reconcileElementsById(undefined, next)).toBe(next);
    expect(reconcileElementsById([], next)).toBe(next);
  });

  it('passes through non-array nextElements as-is', () => {
    expect(reconcileElementsById([{ instanceId: 'a' }], null)).toBe(null);
  });

  it('returns the exact previous array reference when nothing changed at all', () => {
    const prev = [
      { instanceId: 'a', tokenX: 1, tokenY: 2, nested: { hp: 3 } },
      { instanceId: 'b', tokenX: 5, tokenY: 6 },
    ];
    // Deserialized as brand-new objects (as SSE JSON.parse would produce) but deep-equal.
    const next = [
      { instanceId: 'a', tokenX: 1, tokenY: 2, nested: { hp: 3 } },
      { instanceId: 'b', tokenX: 5, tokenY: 6 },
    ];
    const result = reconcileElementsById(prev, next);
    expect(result).toBe(prev);
  });

  it('preserves previous object identity for unchanged elements and uses the new object for changed ones', () => {
    const prevA = { instanceId: 'a', tokenX: 1, tokenY: 2 };
    const prevB = { instanceId: 'b', tokenX: 5, tokenY: 6 };
    const prev = [prevA, prevB];

    const nextA = { instanceId: 'a', tokenX: 1, tokenY: 2 }; // deep-equal to prevA
    const nextB = { instanceId: 'b', tokenX: 99, tokenY: 6 }; // changed
    const next = [nextA, nextB];

    const result = reconcileElementsById(prev, next);
    expect(result).not.toBe(prev); // something changed, so a new array is returned
    expect(result[0]).toBe(prevA); // unchanged element keeps previous reference
    expect(result[1]).toBe(nextB); // changed element uses the new object
    expect(result[1]).not.toBe(prevB);
  });

  it('uses the new object for elements with no matching instanceId in prev (added elements)', () => {
    const prev = [{ instanceId: 'a', tokenX: 1 }];
    const nextNew = { instanceId: 'c', tokenX: 0 };
    const next = [{ instanceId: 'a', tokenX: 1 }, nextNew];
    const result = reconcileElementsById(prev, next);
    expect(result[1]).toBe(nextNew);
  });

  it('drops the reference to a removed element and returns a new array of the remaining length', () => {
    const prevA = { instanceId: 'a', tokenX: 1 };
    const prev = [prevA, { instanceId: 'b', tokenX: 2 }];
    const next = [{ instanceId: 'a', tokenX: 1 }];
    const result = reconcileElementsById(prev, next);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(prevA);
    expect(result).not.toBe(prev);
  });

  it('handles elements without an instanceId by passing the next object through untouched', () => {
    const prev = [{ tokenX: 1 }];
    const nextEl = { tokenX: 1 };
    const result = reconcileElementsById(prev, [nextEl]);
    expect(result[0]).toBe(nextEl);
  });
});
