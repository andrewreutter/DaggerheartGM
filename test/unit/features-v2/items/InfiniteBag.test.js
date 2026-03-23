import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { InfiniteBag } from '../../../../src/features-v2/items/InfiniteBag.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Infinite Bag', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Infinite Bag', id: 'srd-itm-infinite-bag' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Infinite Bag',
        description: InfiniteBag.description,
        _source: 'item',
        _itemId: 'srd-itm-infinite-bag',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Infinite Bag' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Infinite Bag' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Infinite Bag', id: 'srd-itm-infinite-bag' },
          { name: 'Infinite Bag', id: 'srd-itm-infinite-bag' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Infinite Bag').length).toBe(1);
  });
});
