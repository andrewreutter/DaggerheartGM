import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { VialOfDarksmokeRecipe } from '../../../../src/features-v2/items/VialOfDarksmokeRecipe.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Vial of Darksmoke Recipe', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Vial of Darksmoke Recipe', id: 'srd-itm-vial-of-darksmoke-recipe' },
        ],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Vial of Darksmoke Recipe',
        description: VialOfDarksmokeRecipe.description,
        _source: 'item',
        _itemId: 'srd-itm-vial-of-darksmoke-recipe',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Vial of Darksmoke Recipe' }],
      }),
      registry
    );
    expect(
      feats.some((f) => f.name === 'Vial of Darksmoke Recipe' && f._source === 'item')
    ).toBe(true);
  });
});
