import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { MinorStaminaPotionRecipe } from '../../../../src/features-v2/items/MinorStaminaPotionRecipe.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Minor Stamina Potion Recipe', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Minor Stamina Potion Recipe', id: 'srd-itm-minor-stamina-potion-recipe' },
        ],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Minor Stamina Potion Recipe',
        description: MinorStaminaPotionRecipe.description,
        _source: 'item',
        _itemId: 'srd-itm-minor-stamina-potion-recipe',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Minor Stamina Potion Recipe' }],
      }),
      registry
    );
    expect(
      feats.some((f) => f.name === 'Minor Stamina Potion Recipe' && f._source === 'item')
    ).toBe(true);
  });
});
