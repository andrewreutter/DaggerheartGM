import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { CompanionCase } from '../../../../src/features-v2/items/CompanionCase.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Companion Case', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Companion Case', id: 'srd-itm-companion-case' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Companion Case',
        description: CompanionCase.description,
        _source: 'item',
        _itemId: 'srd-itm-companion-case',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Companion Case' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Companion Case' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Companion Case', id: 'srd-itm-companion-case' },
          { name: 'Companion Case', id: 'srd-itm-companion-case' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Companion Case').length).toBe(1);
  });
});
