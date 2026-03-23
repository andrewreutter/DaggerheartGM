import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { ArcaneCloak } from '../../../../src/features-v2/items/ArcaneCloak.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Arcane Cloak', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Arcane Cloak', id: 'srd-itm-arcane-cloak' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Arcane Cloak',
        description: ArcaneCloak.description,
        _source: 'item',
        _itemId: 'srd-itm-arcane-cloak',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Arcane Cloak' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Arcane Cloak' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Arcane Cloak', id: 'srd-itm-arcane-cloak' },
          { name: 'Arcane Cloak', id: 'srd-itm-arcane-cloak' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Arcane Cloak').length).toBe(1);
  });
});
