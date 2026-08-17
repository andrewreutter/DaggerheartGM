import { describe, it, expect } from 'vitest';
import {
  assertAdminCatalogWrite,
  resolveAdminCatalogPut,
  stampAdminCatalogData,
} from '../../src/server/admin-catalog-write.js';

describe('assertAdminCatalogWrite', () => {
  it('returns not-catalog for Mine/Public so the caller uses upsertItem', () => {
    expect(assertAdminCatalogWrite({ isAdmin: true, collection: 'scenes', source: 'own' })).toEqual({
      ok: false,
      reason: 'not-catalog',
    });
    expect(assertAdminCatalogWrite({ isAdmin: false, collection: 'scenes', source: 'public' }).reason).toBe('not-catalog');
  });

  it('403s non-admin catalog writes', () => {
    expect(assertAdminCatalogWrite({ isAdmin: false, collection: 'scenes', source: 'dt' })).toEqual({
      ok: false,
      status: 403,
      error: 'Admin access required',
    });
  });
});

describe('resolveAdminCatalogPut', () => {
  it('admin upserts an existing cache row and keeps the catalog source', () => {
    const result = resolveAdminCatalogPut({
      isAdmin: true,
      collection: 'scenes',
      source: 'dt',
      cachedRows: [{ id: 'srd-scene-abandoned-grove', _source: 'dt' }],
    });
    expect(result).toEqual({ handled: true, ok: true, source: 'dt' });
  });

  it('403s non-admin catalog PUTs', () => {
    const result = resolveAdminCatalogPut({
      isAdmin: false,
      collection: 'adversaries',
      source: 'srd',
      cachedRows: [{ id: 'srd-adv-bear', _source: 'srd' }],
    });
    expect(result).toEqual({ handled: true, status: 403, error: 'Admin access required' });
  });

  it('404s a missing cache id without treating it as a Mine upsert', () => {
    const result = resolveAdminCatalogPut({
      isAdmin: true,
      collection: 'scenes',
      source: 'dt',
      cachedRows: [],
    });
    expect(result).toEqual({ handled: true, status: 404, error: 'Catalog item not found' });
  });

  it('does not handle own items (caller uses upsertItem)', () => {
    expect(resolveAdminCatalogPut({
      isAdmin: true,
      collection: 'scenes',
      source: 'own',
      cachedRows: [],
    })).toEqual({ handled: false });
  });
});

describe('stampAdminCatalogData', () => {
  it('keeps _source and stamps _adminEditedAt', () => {
    const stamped = stampAdminCatalogData({ name: 'Grove' }, 'dt', '2026-08-16T12:00:00.000Z');
    expect(stamped._source).toBe('dt');
    expect(stamped._adminEditedAt).toBe('2026-08-16T12:00:00.000Z');
    expect(stamped.name).toBe('Grove');
  });
});
