import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { DualFlask } from '../../../../src/features-v2/items/DualFlask.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Dual Flask', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Dual Flask', id: 'srd-itm-dual-flask' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Dual Flask',
        description: DualFlask.description,
        _source: 'item',
        _itemId: 'srd-itm-dual-flask',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Dual Flask' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Dual Flask' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Dual Flask', id: 'srd-itm-dual-flask' },
          { name: 'Dual Flask', id: 'srd-itm-dual-flask' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Dual Flask').length).toBe(1);
  });
});
