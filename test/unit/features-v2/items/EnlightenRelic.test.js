import { describe, it, expect } from 'vitest';
import {
  applyDeclarativeFeatures,
  loadCharacterFeatures,
} from '../../../../src/features-v2/engine/feature-loader.js';
import { EnlightenRelic } from '../../../../src/features-v2/items/EnlightenRelic.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Enlighten Relic', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Enlighten Relic', id: 'srd-itm-enlighten-relic' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Enlighten Relic',
        description: EnlightenRelic.description,
        _source: 'item',
        _itemId: 'srd-itm-enlighten-relic',
      })
    );
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Enlighten Relic', id: 'srd-itm-enlighten-relic' },
          { name: 'Enlighten Relic', id: 'srd-itm-enlighten-relic' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Enlighten Relic').length).toBe(1);
  });

  it('adds +1 Knowledge via passiveStatMods', () => {
    const char = mockCharacter({
      traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    });
    const feats = loadCharacterFeatures(
      mockCharacter({
        ...char,
        inventory: [{ name: 'Enlighten Relic', id: 'srd-itm-enlighten-relic' }],
      }),
      registry
    );
    const { stats } = applyDeclarativeFeatures(feats, char, {});
    expect(stats.knowledge).toBe(1);
  });
});
