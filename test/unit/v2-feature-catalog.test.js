/**
 * @file V2 feature catalog (generated JSON + server filter helpers).
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { filterFeatureCatalog, countFeatureCatalog, getFeatureCatalogById } from '../../src/v2-feature-catalog.js';

function hashIds(ids) {
  return createHash('sha256').update(ids.sort().join('\n')).digest('hex');
}

describe('v2-feature-catalog', () => {
  it('filters by featScope', () => {
    const { items, totalCount } = filterFeatureCatalog({
      featScope: ['classes'],
      search: '',
      sort: 'name',
      offset: 0,
      limit: 5000,
    });
    expect(items.length).toBe(totalCount);
    expect(items.every(i => i._scope === 'classes')).toBe(true);
  });

  it('search matches name or parent', () => {
    const full = countFeatureCatalog({ search: '' });
    const narrow = countFeatureCatalog({ search: 'zzzznonexistent' });
    expect(narrow).toBeLessThan(full);
  });

  it('getFeatureCatalogById returns a row', () => {
    const { items } = filterFeatureCatalog({ sort: 'name', offset: 0, limit: 1 });
    const id = items[0].id;
    const row = getFeatureCatalogById(id);
    expect(row?.id).toBe(id);
    expect(getFeatureCatalogById('bogus')).toBeNull();
  });

  it('catalog id set is stable', () => {
    const { items } = filterFeatureCatalog({ sort: 'name', offset: 0, limit: 100000 });
    const ids = items.map(i => i.id);
    expect(ids.length).toBe(569);
    expect(hashIds(ids)).toBe(
      '6ddffac3aae6aebe61aad6cf561f18a81ca5eb0df31ba975f19b792caaa3e7d1'
    );
  });

  it('tier filter keeps only matching tiers and omits untiered rows', () => {
    const t2 = filterFeatureCatalog({ featScope: ['subclasses'], tiers: [2], sort: 'name', limit: 5000 });
    expect(t2.items.length).toBeGreaterThan(0);
    expect(t2.items.every(i => i.tier === 2)).toBe(true);

    const t1Only = filterFeatureCatalog({ tiers: [1], sort: 'name', limit: 5000 });
    expect(t1Only.items.every(i => i.tier === 1)).toBe(true);
    const withNull = filterFeatureCatalog({ sort: 'name', limit: 5000 }).items.filter(i => i.tier == null);
    expect(withNull.length).toBeGreaterThan(0);
  });
});
