import { describe, it, expect } from 'vitest';
import {
  applyDeclarativeFeatures,
  loadCharacterFeatures,
} from '../../../../src/features-v2/engine/feature-loader.js';
import { StrideRelic } from '../../../../src/features-v2/items/StrideRelic.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Stride Relic', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Stride Relic', id: 'srd-itm-stride-relic' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Stride Relic',
        description: StrideRelic.description,
        _source: 'item',
        _itemId: 'srd-itm-stride-relic',
      })
    );
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Stride Relic', id: 'srd-itm-stride-relic' },
          { name: 'Stride Relic', id: 'srd-itm-stride-relic' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Stride Relic').length).toBe(1);
  });

  it('adds +1 Agility via passiveStatMods', () => {
    const char = mockCharacter({
      traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    });
    const feats = loadCharacterFeatures(
      mockCharacter({
        ...char,
        inventory: [{ name: 'Stride Relic', id: 'srd-itm-stride-relic' }],
      }),
      registry
    );
    const { stats } = applyDeclarativeFeatures(feats, char, {});
    expect(stats.agility).toBe(2);
  });
});
