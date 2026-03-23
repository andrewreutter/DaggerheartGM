import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { MythicDustRecipe } from '../../../../src/features-v2/items/MythicDustRecipe.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Mythic Dust Recipe', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Mythic Dust Recipe', id: 'srd-itm-mythic-dust-recipe' },
        ],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Mythic Dust Recipe',
        description: MythicDustRecipe.description,
        _source: 'item',
        _itemId: 'srd-itm-mythic-dust-recipe',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Mythic Dust Recipe' }],
      }),
      registry
    );
    expect(
      feats.some((f) => f.name === 'Mythic Dust Recipe' && f._source === 'item')
    ).toBe(true);
  });
});
