import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { SuspendedRod } from '../../../../src/features-v2/items/SuspendedRod.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Suspended Rod', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Suspended Rod', id: 'srd-itm-suspended-rod' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Suspended Rod',
        description: SuspendedRod.description,
        _source: 'item',
        _itemId: 'srd-itm-suspended-rod',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Suspended Rod' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Suspended Rod' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Suspended Rod', id: 'srd-itm-suspended-rod' },
          { name: 'Suspended Rod', id: 'srd-itm-suspended-rod' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Suspended Rod').length).toBe(1);
  });
});
