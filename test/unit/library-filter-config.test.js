import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SRD_UNIFIED_COLLECTIONS,
  LIBRARY_FILTERS_PERSIST_KEY,
  LIBRARY_SEARCH_GLOBAL_KEY,
  LIBRARY_INCLUDES_GLOBAL_KEY,
  readSharedSearchQuery,
  readSharedIncludes,
  getLibraryFilterConfig,
  LIBRARY_CUSTOM_DETAIL_COLLECTIONS,
  LIBRARY_GENERIC_DETAIL_COLLECTIONS,
  formatFeatScopeLabel,
} from '../../src/client/lib/library-filter-config.js';

const lsStore = new Map();
beforeEach(() => {
  lsStore.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (lsStore.has(k) ? lsStore.get(k) : null),
    setItem: (k, v) => { lsStore.set(k, String(v)); },
    removeItem: (k) => { lsStore.delete(k); },
  });
});

describe('library-filter-config', () => {
  it('includes core SRD collections for unified browse', () => {
    expect(SRD_UNIFIED_COLLECTIONS).toContain('weapons');
    expect(SRD_UNIFIED_COLLECTIONS).toContain('abilities');
    expect(SRD_UNIFIED_COLLECTIONS).toContain('adversaries');
    expect(SRD_UNIFIED_COLLECTIONS).toContain('features');
  });

  it('uses v2 persist key to reset default Mine+SRD after bump', () => {
    expect(LIBRARY_FILTERS_PERSIST_KEY).toBe('dh_collectionFilters_v2');
  });

  it('returns domain + level rank for abilities filters', () => {
    const c = getLibraryFilterConfig('abilities');
    expect(c.rankMode).toBe('level');
    expect(c.typeOptions?.length).toBeGreaterThan(0);
  });

  it('uses tier + scope for features filters', () => {
    const c = getLibraryFilterConfig('features');
    expect(c.rankMode).toBe('tier');
    expect(c.typeOptions?.length).toBeGreaterThan(0);
  });

  it('generic detail excludes form-based collections', () => {
    expect(LIBRARY_GENERIC_DETAIL_COLLECTIONS).toContain('weapons');
    expect(LIBRARY_GENERIC_DETAIL_COLLECTIONS).not.toContain('adversaries');
    expect(LIBRARY_CUSTOM_DETAIL_COLLECTIONS.has('characters')).toBe(true);
  });

  describe('formatFeatScopeLabel', () => {
    it('replaces underscores with spaces and title-cases words', () => {
      expect(formatFeatScopeLabel('weapon_properties')).toBe('Weapon Properties');
      expect(formatFeatScopeLabel('armor_properties')).toBe('Armor Properties');
    });

    it('formats single-token scopes', () => {
      expect(formatFeatScopeLabel('classes')).toBe('Classes');
    });
  });

  describe('readSharedSearchQuery', () => {
    it('returns empty string when key is null', () => {
      expect(readSharedSearchQuery(null)).toBe('');
    });

    it('reads value stored under LIBRARY_SEARCH_GLOBAL_KEY', () => {
      localStorage.setItem(LIBRARY_SEARCH_GLOBAL_KEY, 'dragon');
      expect(readSharedSearchQuery(LIBRARY_SEARCH_GLOBAL_KEY)).toBe('dragon');
    });

    it('returns empty string when key is missing', () => {
      expect(readSharedSearchQuery(LIBRARY_SEARCH_GLOBAL_KEY)).toBe('');
    });
  });

  describe('readSharedIncludes', () => {
    it('returns null when key is null', () => {
      expect(readSharedIncludes(null)).toBe(null);
    });

    it('returns null when key is missing', () => {
      expect(readSharedIncludes(LIBRARY_INCLUDES_GLOBAL_KEY)).toBe(null);
    });

    it('reads JSON array under LIBRARY_INCLUDES_GLOBAL_KEY', () => {
      localStorage.setItem(LIBRARY_INCLUDES_GLOBAL_KEY, JSON.stringify(['own', 'srd']));
      expect(readSharedIncludes(LIBRARY_INCLUDES_GLOBAL_KEY)).toEqual(['own', 'srd']);
    });

    it('returns null for invalid JSON', () => {
      localStorage.setItem(LIBRARY_INCLUDES_GLOBAL_KEY, 'not-json');
      expect(readSharedIncludes(LIBRARY_INCLUDES_GLOBAL_KEY)).toBe(null);
    });
  });
});
