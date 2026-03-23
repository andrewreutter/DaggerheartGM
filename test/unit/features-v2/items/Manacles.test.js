import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { Manacles } from '../../../../src/features-v2/items/Manacles.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Manacles', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Manacles', id: 'srd-itm-manacles' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Manacles',
        description: Manacles.description,
        _source: 'item',
        _itemId: 'srd-itm-manacles',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Manacles' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Manacles' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Manacles', id: 'srd-itm-manacles' },
          { name: 'Manacles', id: 'srd-itm-manacles' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Manacles').length).toBe(1);
  });
});
