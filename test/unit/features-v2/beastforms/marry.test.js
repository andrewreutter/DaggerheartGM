import { describe, it, expect } from 'vitest';
import { marryBeastformFeatures } from '../../../../src/features-v2/beastforms/marry.js';
import { BEASTFORM_ITEMS } from '../../../../src/features-v2/beastforms/srd-data.js';
import { Agile, features as agileScoutFeatures } from '../../../../src/features-v2/beastforms/AgileScout.js';

describe('marryBeastformFeatures', () => {
  it('merges SRD ids and types onto V2 feature objects by name', () => {
    const row = BEASTFORM_ITEMS.find((b) => b.id === 'srd-bst-agile-scout');
    const out = marryBeastformFeatures(row, agileScoutFeatures);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual(
      expect.objectContaining({
        name: 'Agile',
        id: 'srd-bst-agile-scout-feat-agile',
        type: 'passive',
        description: Agile.description,
      })
    );
    expect(out[1].name).toBe('Fragile');
    expect(out[1].id).toBe('srd-bst-agile-scout-feat-fragile');
  });

  it('throws when a V2 feature name is missing from the SRD row', () => {
    const row = BEASTFORM_ITEMS.find((b) => b.id === 'srd-bst-agile-scout');
    expect(() =>
      marryBeastformFeatures(row, [{ name: 'Not A Real Feature', description: 'x' }])
    ).toThrow(/no SRD feature named "Not A Real Feature"/);
  });
});
