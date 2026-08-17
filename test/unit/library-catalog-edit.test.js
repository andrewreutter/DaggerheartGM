import { describe, it, expect } from 'vitest';
import { canEditLibraryCatalogItem, isCatalogSource } from '../../src/client/lib/library-catalog-edit.js';

describe('isCatalogSource', () => {
  it('accepts srd and dt', () => {
    expect(isCatalogSource({ _source: 'srd' })).toBe(true);
    expect(isCatalogSource({ _source: 'dt' })).toBe(true);
    expect(isCatalogSource('srd')).toBe(true);
    expect(isCatalogSource({ _source: 'own' })).toBe(false);
    expect(isCatalogSource({ _source: 'public' })).toBe(false);
  });
});

describe('canEditLibraryCatalogItem', () => {
  it('is true for admin + srd/dt in an editable collection', () => {
    expect(canEditLibraryCatalogItem({ _source: 'srd' }, { isAdmin: true, collection: 'adversaries' })).toBe(true);
    expect(canEditLibraryCatalogItem({ _source: 'dt' }, { isAdmin: true, collection: 'scenes' })).toBe(true);
  });

  it('is false for non-admin, public, features, and readonly collections', () => {
    expect(canEditLibraryCatalogItem({ _source: 'srd' }, { isAdmin: false, collection: 'adversaries' })).toBe(false);
    expect(canEditLibraryCatalogItem({ _source: 'public' }, { isAdmin: true, collection: 'adversaries' })).toBe(false);
    expect(canEditLibraryCatalogItem({ _source: 'own' }, { isAdmin: true, collection: 'scenes' })).toBe(false);
    expect(canEditLibraryCatalogItem({ _source: 'srd' }, { isAdmin: true, collection: 'features' })).toBe(false);
    expect(canEditLibraryCatalogItem({ _source: 'srd' }, { isAdmin: true, collection: 'campaign_frames' })).toBe(false);
    expect(canEditLibraryCatalogItem({ _source: 'srd' }, { isAdmin: true, collection: 'rules' })).toBe(false);
  });
});
