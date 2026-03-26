import { describe, it, expect } from 'vitest';
import {
  LIBRARY_ALL_TIER_RANKED_COLLECTIONS,
  resolveLibraryAllBranchTiers,
  resolveLibraryAllBranchTypes,
  shouldIncludeLibraryAllBranch,
} from '../../src/library-all-branch-opts.js';

describe('resolveLibraryAllBranchTiers', () => {
  const tierNums = [2];
  const levelNums = [3];

  it('maps spell levels to abilities only', () => {
    expect(resolveLibraryAllBranchTiers('abilities', { tierNums, levelNums, includeScaledUp: false })).toEqual({
      tiersParam: [3],
      tierMax: null,
      tierMaxExclusive: false,
    });
    expect(resolveLibraryAllBranchTiers('classes', { tierNums, levelNums, includeScaledUp: false })).toEqual({
      tiersParam: [],
      tierMax: null,
      tierMaxExclusive: false,
    });
  });

  it('applies tier to tier-ranked collections', () => {
    for (const c of LIBRARY_ALL_TIER_RANKED_COLLECTIONS) {
      expect(resolveLibraryAllBranchTiers(c, { tierNums, levelNums, includeScaledUp: false })).toEqual({
        tiersParam: [2],
        tierMax: null,
        tierMaxExclusive: false,
      });
    }
  });

  it('uses tierMax + exclusive tiers for scaled adversaries', () => {
    expect(
      resolveLibraryAllBranchTiers('adversaries', { tierNums: [2], levelNums, includeScaledUp: true })
    ).toEqual({ tiersParam: [], tierMax: 2, tierMaxExclusive: true });
  });
});

describe('resolveLibraryAllBranchTypes', () => {
  const advRole = ['Standard'];
  const envType = ['Wilderness'];
  const ablDomain = ['Arcana'];
  const wpnSlot = ['Primary'];
  const wpnPhyMag = ['Physical'];

  it('routes namespaced type filters to the correct collection', () => {
    expect(resolveLibraryAllBranchTypes('adversaries', { advRole, envType, ablDomain, wpnSlot, wpnPhyMag })).toEqual({
      typeValues: advRole,
      extraTypeValues: [],
    });
    expect(resolveLibraryAllBranchTypes('environments', { advRole, envType, ablDomain, wpnSlot, wpnPhyMag })).toEqual({
      typeValues: envType,
      extraTypeValues: [],
    });
    expect(resolveLibraryAllBranchTypes('abilities', { advRole, envType, ablDomain, wpnSlot, wpnPhyMag })).toEqual({
      typeValues: ablDomain,
      extraTypeValues: [],
    });
    expect(resolveLibraryAllBranchTypes('weapons', { advRole, envType, ablDomain, wpnSlot, wpnPhyMag })).toEqual({
      typeValues: wpnSlot,
      extraTypeValues: wpnPhyMag,
    });
    expect(resolveLibraryAllBranchTypes('classes', { advRole, envType, ablDomain, wpnSlot, wpnPhyMag })).toEqual({
      typeValues: [],
      extraTypeValues: [],
    });
  });
});

describe('shouldIncludeLibraryAllBranch', () => {
  const base = { tiers: [], levels: [], advRole: [], envType: [], ablDomain: [], wpnSlot: [], wpnPhyMag: [], featScope: [] };

  it('includes every branch when no structural filters are active', () => {
    expect(shouldIncludeLibraryAllBranch('classes', base)).toBe(true);
    expect(shouldIncludeLibraryAllBranch('adversaries', base)).toBe(true);
    expect(shouldIncludeLibraryAllBranch('features', base)).toBe(true);
  });

  it('with tier only, includes tier-ranked collections and excludes others', () => {
    const o = { ...base, tiers: [2] };
    expect(shouldIncludeLibraryAllBranch('adversaries', o)).toBe(true);
    expect(shouldIncludeLibraryAllBranch('classes', o)).toBe(false);
    expect(shouldIncludeLibraryAllBranch('features', o)).toBe(false);
  });

  it('with advRole only, includes adversaries only', () => {
    const o = { ...base, advRole: ['Standard'] };
    expect(shouldIncludeLibraryAllBranch('adversaries', o)).toBe(true);
    expect(shouldIncludeLibraryAllBranch('environments', o)).toBe(false);
  });

  it('with only advRole (exclusive filters), includes adversaries only', () => {
    const o = { ...base, advRole: ['Standard'] };
    expect(shouldIncludeLibraryAllBranch('environments', o)).toBe(false);
    expect(shouldIncludeLibraryAllBranch('adversaries', o)).toBe(true);
  });

  it('featScope limits to features branch', () => {
    const o = { ...base, featScope: ['classes'] };
    expect(shouldIncludeLibraryAllBranch('features', o)).toBe(true);
    expect(shouldIncludeLibraryAllBranch('adversaries', o)).toBe(false);
  });
});
