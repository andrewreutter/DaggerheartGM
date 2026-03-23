import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { MinorHealthPotionRecipe } from '../../../../src/features-v2/items/MinorHealthPotionRecipe.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Minor Health Potion Recipe', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Minor Health Potion Recipe', id: 'srd-itm-minor-health-potion-recipe' },
        ],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Minor Health Potion Recipe',
        description: MinorHealthPotionRecipe.description,
        _source: 'item',
        _itemId: 'srd-itm-minor-health-potion-recipe',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Minor Health Potion Recipe' }],
      }),
      registry
    );
    expect(
      feats.some((f) => f.name === 'Minor Health Potion Recipe' && f._source === 'item')
    ).toBe(true);
  });
});
