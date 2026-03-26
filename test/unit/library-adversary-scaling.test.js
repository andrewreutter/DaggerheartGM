import { describe, it, expect } from 'vitest';
import {
  applyAdversaryScaledFilter,
  applyLibraryAllAdversaryScaling,
} from '../../src/client/lib/library-adversary-scaling.js';

describe('applyAdversaryScaledFilter', () => {
  it('returns rows unchanged when not upscaled mode', () => {
    const items = [{ id: 'a', tier: 3, role: 'standard', name: 'X' }];
    expect(applyAdversaryScaledFilter(items, { includeScaledUp: false, singleTier: 3 })).toEqual(items);
  });

  it('drops native at-tier adversaries and keeps only scaled-up rows', () => {
    const low = { id: 'low', tier: 1, role: 'standard', name: 'Goblin' };
    const native = { id: 'nat', tier: 3, role: 'standard', name: 'Boss' };
    const out = applyAdversaryScaledFilter([low, native], { includeScaledUp: true, singleTier: 3 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('low');
    expect(out[0].tier).toBe(3);
    expect(out[0]._scaledFromTier).toBe(1);
  });
});

describe('applyLibraryAllAdversaryScaling', () => {
  it('only transforms adversaries rows in merged All list', () => {
    const adv = { _collection: 'adversaries', id: 'a', tier: 1, role: 'standard', name: 'G' };
    const env = { _collection: 'environments', id: 'e', tier: 2, name: 'Forest' };
    const out = applyLibraryAllAdversaryScaling([adv, env], { includeScaledUp: true, tiers: [3] });
    expect(out.find(x => x._collection === 'environments')).toEqual(env);
    expect(out.find(x => x._collection === 'adversaries')?.tier).toBe(3);
    expect(out.find(x => x._collection === 'adversaries')?._scaledFromTier).toBe(1);
  });
});
