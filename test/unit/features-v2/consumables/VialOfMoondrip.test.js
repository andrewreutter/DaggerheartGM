import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { VialOfMoondrip } from '../../../../src/features-v2/consumables/VialOfMoondrip.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Consumables — Vial of Moondrip', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Vial of Moondrip', id: 'srd-cns-vial-of-moondrip' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Vial of Moondrip',
        description: VialOfMoondrip.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-vial-of-moondrip',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Vial of Moondrip' }],
      }),
      registry
    );
    expect(
      feats.some((f) => f.name === 'Vial of Moondrip' && f._source === 'consumable')
    ).toBe(true);
  });
});
