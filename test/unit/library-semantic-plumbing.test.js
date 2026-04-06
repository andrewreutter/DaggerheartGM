import { describe, expect, it } from 'vitest';
import {
  LIBRARY_NON_CLONEABLE_COLLECTIONS,
  LIBRARY_READONLY_SRD_COLLECTIONS,
  LIBRARY_USER_EDITABLE_COLLECTIONS,
} from '../../src/client/lib/library-filter-config.js';
import { buildLibraryAllApiOpts, buildLibraryAllSearchParams } from '../../src/client/lib/library-all-api-params.js';
import { buildLibraryBrowsePath, buildLibraryModalPath } from '../../src/client/lib/library-modal-path.js';

describe('library semantic plumbing', () => {
  it('marks new document-backed SRD collections as read-only and non-cloneable', () => {
    expect(LIBRARY_READONLY_SRD_COLLECTIONS.has('campaign_frames')).toBe(true);
    expect(LIBRARY_READONLY_SRD_COLLECTIONS.has('rules')).toBe(true);
    expect(LIBRARY_USER_EDITABLE_COLLECTIONS.has('campaign_frames')).toBe(false);
    expect(LIBRARY_USER_EDITABLE_COLLECTIONS.has('rules')).toBe(false);
    expect(LIBRARY_NON_CLONEABLE_COLLECTIONS.has('campaign_frames')).toBe(true);
    expect(LIBRARY_NON_CLONEABLE_COLLECTIONS.has('rules')).toBe(true);
  });

  it('serializes semantic search for merged library requests', () => {
    const opts = buildLibraryAllApiOpts({
      includes: ['srd', 'public'],
      search: 'witherwild',
      semantic: 'comes from the trees',
      tiers: [2],
      sort: 'name',
    });
    expect(opts).toMatchObject({
      includeMine: false,
      includeSrd: true,
      includePublic: true,
      includeHod: false,
      search: 'witherwild',
      semantic: 'comes from the trees',
      tiers: [2],
      sort: 'name',
    });

    const params = buildLibraryAllSearchParams(opts).toString();
    expect(params).toContain('search=witherwild');
    expect(params).toContain('semantic=comes+from+the+trees');
    expect(params).toContain('tier=2');
  });

  it('builds browse and modal paths with semantic handoff params', () => {
    expect(buildLibraryBrowsePath('all', { semantic: 'comes from the trees' })).toBe('/library/all?semantic=comes+from+the+trees');
    expect(buildLibraryModalPath('all', 'rules', 'srd-short-rest', { search: 'rest', semantic: 'rest options' })).toBe(
      '/library/all/srd-short-rest?search=rest&semantic=rest+options'
    );
  });
});
