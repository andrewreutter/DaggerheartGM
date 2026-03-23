import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { GlamourStone } from '../../../../src/features-v2/items/GlamourStone.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Glamour Stone', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Glamour Stone', id: 'srd-itm-glamour-stone' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Glamour Stone',
        description: GlamourStone.description,
        hopeCost: 1,
        _source: 'item',
        _itemId: 'srd-itm-glamour-stone',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Glamour Stone' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Glamour Stone' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Glamour Stone', id: 'srd-itm-glamour-stone' },
          { name: 'Glamour Stone', id: 'srd-itm-glamour-stone' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Glamour Stone').length).toBe(1);
  });
});
