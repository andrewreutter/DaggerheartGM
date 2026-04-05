import { describe, it, expect } from 'vitest';
import {
  fetchCharacterBuilderDetails,
  MAX_CHARACTER_BUILDER_FETCH_ITEMS,
} from '../../src/character-ai-builder-fetch-details.js';

function miniSrd() {
  const classes = [{ id: 'srd-cls-bard', name: 'Bard', domains: ['Grace'] }];
  const weapons = [{ id: 'srd-wpn-rapier', name: 'Rapier', tier: 1 }];
  const buildById = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  return {
    classes,
    weapons,
    classesById: buildById(classes),
    weaponsById: buildById(weapons),
  };
}

describe('fetchCharacterBuilderDetails', () => {
  it('returns full rows by collection and id', () => {
    const srd = miniSrd();
    const out = fetchCharacterBuilderDetails(
      [
        { collection: 'classes', id: 'srd-cls-bard' },
        { collection: 'weapons', id: 'srd-wpn-rapier' },
      ],
      srd,
    );
    expect(out.items.classes['srd-cls-bard'].name).toBe('Bard');
    expect(out.items.weapons['srd-wpn-rapier'].name).toBe('Rapier');
    expect(out.notFound).toHaveLength(0);
    expect(out.truncated).toBe(false);
  });

  it('lists unknown ids in notFound', () => {
    const srd = miniSrd();
    const out = fetchCharacterBuilderDetails([{ collection: 'classes', id: 'srd-cls-missing' }], srd);
    expect(out.notFound).toEqual([{ collection: 'classes', id: 'srd-cls-missing' }]);
    expect(out.items.classes || {}).toEqual({});
  });

  it('records invalid collection in skippedInvalid', () => {
    const srd = miniSrd();
    const out = fetchCharacterBuilderDetails([{ collection: 'beastforms', id: 'x' }], srd);
    expect(out.skippedInvalid.some((s) => s.reason.includes('unknown collection'))).toBe(true);
  });

  it('truncates beyond max items', () => {
    const srd = miniSrd();
    const many = Array.from({ length: MAX_CHARACTER_BUILDER_FETCH_ITEMS + 5 }, (_, i) => ({
      collection: 'weapons',
      id: `srd-wpn-rapier-${i}`,
    }));
    const out = fetchCharacterBuilderDetails(many, srd);
    expect(out.truncated).toBe(true);
    expect(out.skippedInvalid.some((s) => String(s.reason).includes('only first'))).toBe(true);
  });
});
