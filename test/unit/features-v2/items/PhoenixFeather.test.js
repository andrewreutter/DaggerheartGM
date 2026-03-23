import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { PhoenixFeather } from '../../../../src/features-v2/items/PhoenixFeather.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Phoenix Feather', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Phoenix Feather', id: 'srd-itm-phoenix-feather' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Phoenix Feather',
        description: PhoenixFeather.description,
        _source: 'item',
        _itemId: 'srd-itm-phoenix-feather',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Phoenix Feather' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Phoenix Feather' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Phoenix Feather', id: 'srd-itm-phoenix-feather' },
          { name: 'Phoenix Feather', id: 'srd-itm-phoenix-feather' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Phoenix Feather').length).toBe(1);
  });
});
