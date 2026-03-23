import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { WovenNet } from '../../../../src/features-v2/items/WovenNet.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Woven Net', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Woven Net', id: 'srd-itm-woven-net' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Woven Net',
        description: WovenNet.description,
        _source: 'item',
        _itemId: 'srd-itm-woven-net',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Woven Net' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Woven Net' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Woven Net', id: 'srd-itm-woven-net' },
          { name: 'Woven Net', id: 'srd-itm-woven-net' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Woven Net').length).toBe(1);
  });
});
