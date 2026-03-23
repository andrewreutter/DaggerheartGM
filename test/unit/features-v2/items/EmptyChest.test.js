import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { EmptyChest } from '../../../../src/features-v2/items/EmptyChest.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Empty Chest', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Empty Chest', id: 'srd-itm-empty-chest' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Empty Chest',
        description: EmptyChest.description,
        _source: 'item',
        _itemId: 'srd-itm-empty-chest',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Empty Chest' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Empty Chest' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Empty Chest', id: 'srd-itm-empty-chest' },
          { name: 'Empty Chest', id: 'srd-itm-empty-chest' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Empty Chest').length).toBe(1);
  });
});
