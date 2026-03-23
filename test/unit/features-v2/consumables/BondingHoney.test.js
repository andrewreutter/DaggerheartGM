import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { BondingHoney } from '../../../../src/features-v2/consumables/BondingHoney.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Consumables — Bonding Honey', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Bonding Honey', id: 'srd-cns-bonding-honey' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Bonding Honey',
        description: BondingHoney.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-bonding-honey',
      })
    );
  });

  it('has no default card automation (narrative-only)', () => {
    expect(BondingHoney.onUse).toBeUndefined();
  });
});
