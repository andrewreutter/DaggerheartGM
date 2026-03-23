import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { ClayCompanion } from '../../../../src/features-v2/items/ClayCompanion.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Clay Companion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Clay Companion', id: 'srd-itm-clay-companion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Clay Companion',
        description: ClayCompanion.description,
        _source: 'item',
        _itemId: 'srd-itm-clay-companion',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Clay Companion' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Clay Companion' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Clay Companion', id: 'srd-itm-clay-companion' },
          { name: 'Clay Companion', id: 'srd-itm-clay-companion' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Clay Companion').length).toBe(1);
  });
});
