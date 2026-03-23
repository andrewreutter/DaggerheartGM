import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { AlistairsTorch } from '../../../../src/features-v2/items/AlistairsTorch.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe("Items — Alistair's Torch", () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: "Alistair's Torch", id: 'srd-itm-alistair-s-torch' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: "Alistair's Torch",
        description: AlistairsTorch.description,
        _source: 'item',
        _itemId: 'srd-itm-alistair-s-torch',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: "Alistair's Torch" }],
      }),
      registry
    );
    expect(
      feats.some((f) => f.name === "Alistair's Torch" && f._source === 'item')
    ).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: "Alistair's Torch", id: 'srd-itm-alistair-s-torch' },
          { name: "Alistair's Torch", id: 'srd-itm-alistair-s-torch' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === "Alistair's Torch").length).toBe(1);
  });
});
