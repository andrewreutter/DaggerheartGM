import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { PortalSeed } from '../../../../src/features-v2/items/PortalSeed.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Portal Seed', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Portal Seed', id: 'srd-itm-portal-seed' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Portal Seed',
        description: PortalSeed.description,
        _source: 'item',
        _itemId: 'srd-itm-portal-seed',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Portal Seed' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Portal Seed' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Portal Seed', id: 'srd-itm-portal-seed' },
          { name: 'Portal Seed', id: 'srd-itm-portal-seed' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Portal Seed').length).toBe(1);
  });
});
