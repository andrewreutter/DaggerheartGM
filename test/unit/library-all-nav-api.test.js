/**
 * Library “All” API param builders (used for list + nav counts) — pure, no DB.
 */
import { describe, it, expect } from 'vitest';
import { buildLibraryAllSearchParams, buildLibraryAllApiOpts } from '../../src/client/lib/library-all-api-params.js';

describe('buildLibraryAllApiOpts', () => {
  it('maps includes to include* flags (empty includes = all sources)', () => {
    const o = buildLibraryAllApiOpts({
      includes: [],
      tiers: [],
      levels: [],
      advRole: [],
      envType: [],
      ablDomain: [],
      wpnSlot: [],
      wpnPhyMag: [],
      featScope: [],
      search: 'foo',
      includeScaledUp: false,
      sort: 'name',
    });
    expect(o.includeMine).toBe(true);
    expect(o.includeSrd).toBe(true);
    expect(o.includePublic).toBe(true);
    expect(o.includeHod).toBe(true);
    expect(o.search).toBe('foo');
    expect(o.sort).toBe('name');
  });

  it('restricts sources when includes is non-empty', () => {
    const o = buildLibraryAllApiOpts({
      includes: ['own', 'srd'],
      tiers: [2],
      levels: [],
      advRole: [],
      envType: [],
      ablDomain: [],
      wpnSlot: [],
      wpnPhyMag: [],
      featScope: [],
      search: '',
      includeScaledUp: false,
      sort: 'popularity',
    });
    expect(o.includeMine).toBe(true);
    expect(o.includeSrd).toBe(true);
    expect(o.includePublic).toBe(false);
    expect(o.includeHod).toBe(false);
    expect(o.tiers).toEqual([2]);
  });

  it('passes featScope for V2 Features branch (single-select)', () => {
    const o = buildLibraryAllApiOpts({
      includes: [],
      featScope: ['classes'],
      search: '',
      includeScaledUp: false,
      sort: 'name',
    });
    expect(o.featScope).toEqual(['classes']);
  });
});

describe('buildLibraryAllSearchParams', () => {
  it('serializes tier/level and namespaced arrays for GET library-all / library-all-counts', () => {
    const params = buildLibraryAllSearchParams({
      includeMine: true,
      includeSrd: true,
      includePublic: false,
      includeHod: false,
      search: 'test',
      tiers: [1, 2],
      levels: [3],
      advRole: ['Standard'],
      envType: ['Wild'],
      ablDomain: ['Arcana'],
      wpnSlot: ['Primary'],
      wpnPhyMag: ['Physical'],
      featScope: ['weapon_properties'],
      includeScaledUp: true,
      sort: 'tier',
      offset: 0,
      limit: 20,
    });
    const s = params.toString();
    expect(s).toContain('tier=1');
    expect(s).toContain('tier=2');
    expect(s).toContain('level=3');
    expect(s).toContain('advRole=Standard');
    expect(s).toContain('envType=Wild');
    expect(s).toContain('ablDomain=Arcana');
    expect(s).toContain('wpnSlot=Primary');
    expect(s).toContain('wpnPhyMag=Physical');
    expect(s).toContain('featScope=weapon_properties');
    expect(s).toContain('includeScaledUp=1');
    expect(s).toContain('search=test');
    expect(s).toContain('sort=tier');
  });
});
