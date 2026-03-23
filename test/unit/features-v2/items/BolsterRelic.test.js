import { describe, it, expect } from 'vitest';
import {
  applyDeclarativeFeatures,
  loadCharacterFeatures,
} from '../../../../src/features-v2/engine/feature-loader.js';
import { BolsterRelic } from '../../../../src/features-v2/items/BolsterRelic.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Bolster Relic', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Bolster Relic', id: 'srd-itm-bolster-relic' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Bolster Relic',
        description: BolsterRelic.description,
        _source: 'item',
        _itemId: 'srd-itm-bolster-relic',
      })
    );
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Bolster Relic', id: 'srd-itm-bolster-relic' },
          { name: 'Bolster Relic', id: 'srd-itm-bolster-relic' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Bolster Relic').length).toBe(1);
  });

  it('adds +1 Strength via passiveStatMods', () => {
    const char = mockCharacter({
      traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    });
    const feats = loadCharacterFeatures(
      mockCharacter({
        ...char,
        inventory: [{ name: 'Bolster Relic', id: 'srd-itm-bolster-relic' }],
      }),
      registry
    );
    const { stats } = applyDeclarativeFeatures(feats, char, {});
    expect(stats.strength).toBe(2);
  });
});
