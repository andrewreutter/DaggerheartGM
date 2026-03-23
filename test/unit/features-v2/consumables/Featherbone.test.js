import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { Featherbone } from '../../../../src/features-v2/consumables/Featherbone.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Consumables — Featherbone', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Featherbone', id: 'srd-cns-featherbone' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Featherbone',
        description: Featherbone.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-featherbone',
      })
    );
  });

  it('has no default card automation (narrative-only)', () => {
    expect(Featherbone.onUse).toBeUndefined();
  });
});
