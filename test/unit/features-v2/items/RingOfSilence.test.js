import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { RingOfSilence } from '../../../../src/features-v2/items/RingOfSilence.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Ring of Silence', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Ring of Silence', id: 'srd-itm-ring-of-silence' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Ring of Silence',
        description: RingOfSilence.description,
        hopeCost: 1,
        _source: 'item',
        _itemId: 'srd-itm-ring-of-silence',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Ring of Silence' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Ring of Silence' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Ring of Silence', id: 'srd-itm-ring-of-silence' },
          { name: 'Ring of Silence', id: 'srd-itm-ring-of-silence' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Ring of Silence').length).toBe(1);
  });
});
