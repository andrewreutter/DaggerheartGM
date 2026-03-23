import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { FireJar } from '../../../../src/features-v2/items/FireJar.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Fire Jar', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Fire Jar', id: 'srd-itm-fire-jar' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Fire Jar',
        description: FireJar.description,
        _source: 'item',
        _itemId: 'srd-itm-fire-jar',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Fire Jar' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Fire Jar' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Fire Jar', id: 'srd-itm-fire-jar' },
          { name: 'Fire Jar', id: 'srd-itm-fire-jar' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Fire Jar').length).toBe(1);
  });
});
