import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { PotionOfStability } from '../../../../src/features-v2/consumables/PotionOfStability.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Consumables — Potion of Stability', () => {
  it('loads from inventory by SRD id (narrative-only)', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Potion of Stability', id: 'srd-cns-potion-of-stability' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Potion of Stability',
        description: PotionOfStability.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-potion-of-stability',
      })
    );
  });
});
