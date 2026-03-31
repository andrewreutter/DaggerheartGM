import { describe, it, expect } from 'vitest';
import { indexResolvedItemsByRequestId } from '../../src/client/lib/resolve-items-index.js';

describe('indexResolvedItemsByRequestId', () => {
  it('indexes by id and _clonedFrom for adopt resolve lookups', () => {
    const srdId = 'srd-adv-test';
    const cloneId = '550e8400-e29b-41d4-a716-446655440000';
    const items = [{ id: cloneId, name: 'Clone', _clonedFrom: srdId, _source: 'own' }];
    const m = indexResolvedItemsByRequestId(items);
    expect(m[cloneId]).toBe(items[0]);
    expect(m[srdId]).toBe(items[0]);
  });

  it('handles empty and undefined', () => {
    expect(indexResolvedItemsByRequestId(undefined)).toEqual({});
    expect(indexResolvedItemsByRequestId([])).toEqual({});
  });
});
