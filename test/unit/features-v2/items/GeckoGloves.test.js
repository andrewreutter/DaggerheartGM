import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { GeckoGloves } from '../../../../src/features-v2/items/GeckoGloves.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Gecko Gloves', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Gecko Gloves', id: 'srd-itm-gecko-gloves' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Gecko Gloves',
        description: GeckoGloves.description,
        _source: 'item',
        _itemId: 'srd-itm-gecko-gloves',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Gecko Gloves' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Gecko Gloves' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Gecko Gloves', id: 'srd-itm-gecko-gloves' },
          { name: 'Gecko Gloves', id: 'srd-itm-gecko-gloves' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Gecko Gloves').length).toBe(1);
  });
});
