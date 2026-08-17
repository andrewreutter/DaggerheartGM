import { describe, it, expect } from 'vitest';
import {
  normalizePersistedIncludes,
  LIBRARY_DEFAULT_INCLUDES,
  catalogCacheSourceForCollection,
  librarySourceModeOptionsForCollection,
  LIBRARY_SOURCE_MODE_OPTIONS,
} from '../../src/client/lib/library-default-filters.js';

describe('normalizePersistedIncludes', () => {
  it('removes discontinued hod key', () => {
    expect(normalizePersistedIncludes(['own', 'hod', 'srd'])).toEqual(['own', 'srd']);
  });

  it('removes discontinued fcg key', () => {
    expect(normalizePersistedIncludes(['own', 'fcg', 'srd'])).toEqual(['own', 'srd']);
  });

  it('passes through undefined and non-arrays', () => {
    expect(normalizePersistedIncludes(undefined)).toBe(undefined);
    expect(normalizePersistedIncludes(null)).toBe(null);
  });

  it('leaves default-shaped arrays unchanged', () => {
    expect(normalizePersistedIncludes([...LIBRARY_DEFAULT_INCLUDES])).toEqual([...LIBRARY_DEFAULT_INCLUDES]);
  });
});

describe('catalogCacheSourceForCollection', () => {
  it('returns dt for scenes and srd otherwise', () => {
    expect(catalogCacheSourceForCollection('scenes')).toBe('dt');
    expect(catalogCacheSourceForCollection('adversaries')).toBe('srd');
    expect(catalogCacheSourceForCollection('library')).toBe('srd');
  });
});

describe('librarySourceModeOptionsForCollection', () => {
  it('keeps Mine+SRD / SRD labels for non-scene tabs', () => {
    expect(librarySourceModeOptionsForCollection('adversaries')).toBe(LIBRARY_SOURCE_MODE_OPTIONS);
    expect(librarySourceModeOptionsForCollection('library').map((o) => o.label)).toEqual([
      'All', 'Mine+SRD', 'Mine', 'SRD', 'Public',
    ]);
  });

  it('remaps Mine+SRD and SRD labels to DT for scenes', () => {
    const opts = librarySourceModeOptionsForCollection('scenes');
    expect(opts.map((o) => ({ mode: o.mode, label: o.label }))).toEqual([
      { mode: 'all', label: 'All' },
      { mode: 'mine_srd', label: 'Mine+DT' },
      { mode: 'own', label: 'Mine' },
      { mode: 'srd', label: 'DT' },
      { mode: 'public', label: 'Public' },
    ]);
  });
});
