import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { LakestriderBoots } from '../../../../src/features-v2/items/LakestriderBoots.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Lakestrider Boots', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Lakestrider Boots', id: 'srd-itm-lakestrider-boots' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Lakestrider Boots',
        description: LakestriderBoots.description,
        _source: 'item',
        _itemId: 'srd-itm-lakestrider-boots',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Lakestrider Boots' }],
      }),
      registry
    );
    expect(
      feats.some((f) => f.name === 'Lakestrider Boots' && f._source === 'item')
    ).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Lakestrider Boots', id: 'srd-itm-lakestrider-boots' },
          { name: 'Lakestrider Boots', id: 'srd-itm-lakestrider-boots' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Lakestrider Boots').length).toBe(1);
  });
});
