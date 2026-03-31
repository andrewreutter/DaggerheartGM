import { describe, it, expect } from 'vitest';
import { filterEncounterCatalogBySource } from '../../src/llm-encounter-builder.js';

describe('filterEncounterCatalogBySource', () => {
  const rows = [
    { id: 'srd-adv-a', name: 'A', _source: 'srd' },
    { id: 'fcg-1', name: 'FCG', _source: 'public' },
    { id: 'own-1', name: 'Mine', _source: 'own' },
    { id: 'pub-1', name: 'Other public', _source: 'public' },
  ];

  it('passes through when includePublic is true', () => {
    expect(filterEncounterCatalogBySource(rows, true).length).toBe(4);
  });

  it('drops fcg- and public-source rows when includePublic is false', () => {
    const out = filterEncounterCatalogBySource(rows, false);
    expect(out.map((r) => r.id)).toEqual(['srd-adv-a', 'own-1']);
  });
});
