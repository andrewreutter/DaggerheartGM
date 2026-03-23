import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { HomingCompasses } from '../../../../src/features-v2/items/HomingCompasses.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Homing Compasses', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Homing Compasses', id: 'srd-itm-homing-compasses' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Homing Compasses',
        description: HomingCompasses.description,
        _source: 'item',
        _itemId: 'srd-itm-homing-compasses',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Homing Compasses' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Homing Compasses' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Homing Compasses', id: 'srd-itm-homing-compasses' },
          { name: 'Homing Compasses', id: 'srd-itm-homing-compasses' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Homing Compasses').length).toBe(1);
  });
});
