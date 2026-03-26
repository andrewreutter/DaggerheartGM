import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SHARED_FILTERS,
  mergeSharedFromCollectionFilters,
  sharedToCollectionFilters,
  normalizeTierList,
  normalizeLevelList,
  normalizeBinaryPickList,
  normalizeSharedStructuralExclusivity,
  shouldSuppressStructuralAllHighlight,
  getStructuralRowGroupForCollection,
} from '../../src/client/lib/library-shared-filters.js';

describe('library-shared-filters', () => {
  it('normalizeTierList collapses legacy multi-select to one tier', () => {
    expect(normalizeTierList([3, 1, 2])).toEqual([1]);
    expect(normalizeTierList([4])).toEqual([4]);
    expect(normalizeTierList([])).toEqual([]);
  });

  it('normalizeLevelList collapses legacy multi-select to one level', () => {
    expect(normalizeLevelList([5, 3])).toEqual([3]);
  });

  it('normalizeSinglePickList keeps at most one typed filter value', () => {
    expect(normalizeBinaryPickList([])).toEqual([]);
    expect(normalizeBinaryPickList(['Primary'])).toEqual(['Primary']);
    expect(normalizeBinaryPickList(['Primary', 'Secondary'])).toEqual(['Primary']);
  });

  it('sharedToCollectionFilters normalizes weapon picks from shared', () => {
    const shared = { ...DEFAULT_SHARED_FILTERS, wpnSlot: ['Primary', 'Secondary'], wpnPhyMag: ['Magical'] };
    const w = sharedToCollectionFilters('weapons', shared, { sort: 'name' });
    expect(w.types).toEqual(['Primary']);
    expect(w.extraTypes).toEqual(['Magical']);
  });

  it('sharedToCollectionFilters normalizes a single adversary role from shared', () => {
    const shared = { ...DEFAULT_SHARED_FILTERS, advRole: ['solo', 'standard'] };
    const a = sharedToCollectionFilters('adversaries', shared, { sort: 'name' });
    expect(a.types).toEqual(['solo']);
  });

  it('carries tier 2 from shared into armor and weapons', () => {
    const shared = { ...DEFAULT_SHARED_FILTERS, tiers: [2] };
    const w = sharedToCollectionFilters('weapons', shared, { sort: 'name' });
    const a = sharedToCollectionFilters('armor', shared, { sort: 'name' });
    expect(w.tiers).toEqual([2]);
    expect(a.tiers).toEqual([2]);
  });

  it('shared levels apply to abilities; shared tiers apply to tier-ranked tabs (exclusive storage)', () => {
    const byLevel = normalizeSharedStructuralExclusivity({ ...DEFAULT_SHARED_FILTERS, levels: [5] });
    const abl = sharedToCollectionFilters('abilities', byLevel, { sort: 'name' });
    const arm = sharedToCollectionFilters('armor', byLevel, { sort: 'name' });
    expect(abl.tiers).toEqual([5]);
    expect(arm.tiers).toEqual([]);
    const byTier = normalizeSharedStructuralExclusivity({ ...DEFAULT_SHARED_FILTERS, tiers: [2] });
    expect(sharedToCollectionFilters('armor', byTier, { sort: 'name' }).tiers).toEqual([2]);
  });

  it('mergeSharedFromCollectionFilters clears other structural groups when the mutating key wins', () => {
    let shared = { ...DEFAULT_SHARED_FILTERS, tiers: [2] };
    shared = mergeSharedFromCollectionFilters(
      'weapons',
      { tiers: [2], types: ['Primary'], extraTypes: [], sort: 'name', includeScaledUp: false },
      shared,
      'type'
    );
    expect(shared.wpnSlot).toEqual(['Primary']);
    expect(shared.tiers).toEqual([]);
    shared = mergeSharedFromCollectionFilters(
      'adversaries',
      { tiers: [2], types: ['solo'], extraTypes: [], sort: 'name', includeScaledUp: false },
      shared,
      'type'
    );
    expect(shared.advRole).toEqual(['solo']);
    expect(shared.wpnSlot).toEqual([]);
  });

  it('shouldSuppressStructuralAllHighlight dims competing rows only', () => {
    expect(shouldSuppressStructuralAllHighlight('tier', 'advRole')).toBe(true);
    expect(shouldSuppressStructuralAllHighlight('tier', 'tier')).toBe(false);
    expect(shouldSuppressStructuralAllHighlight(null, 'tier')).toBe(false);
  });

  it('getStructuralRowGroupForCollection maps Library rows to structural groups', () => {
    expect(getStructuralRowGroupForCollection('adversaries', 'rank')).toBe('tier');
    expect(getStructuralRowGroupForCollection('abilities', 'rank')).toBe('level');
    expect(getStructuralRowGroupForCollection('adversaries', 'type')).toBe('advRole');
    expect(getStructuralRowGroupForCollection('weapons', 'type')).toBe('weapon');
    expect(getStructuralRowGroupForCollection('weapons', 'extraType')).toBe('weapon');
    expect(getStructuralRowGroupForCollection('armor', 'type')).toBe(null);
  });
});
