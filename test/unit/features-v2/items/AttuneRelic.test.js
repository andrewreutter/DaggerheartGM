import { describe, it, expect } from 'vitest';
import {
  applyDeclarativeFeatures,
  loadCharacterFeatures,
} from '../../../../src/features-v2/engine/feature-loader.js';
import { AttuneRelic } from '../../../../src/features-v2/items/AttuneRelic.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Attune Relic', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Attune Relic', id: 'srd-itm-attune-relic' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Attune Relic',
        description: AttuneRelic.description,
        _source: 'item',
        _itemId: 'srd-itm-attune-relic',
      })
    );
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Attune Relic', id: 'srd-itm-attune-relic' },
          { name: 'Attune Relic', id: 'srd-itm-attune-relic' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Attune Relic').length).toBe(1);
  });

  it('adds +1 Instinct via passiveStatMods', () => {
    const char = mockCharacter({
      traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    });
    const feats = loadCharacterFeatures(
      mockCharacter({
        ...char,
        inventory: [{ name: 'Attune Relic', id: 'srd-itm-attune-relic' }],
      }),
      registry
    );
    const { stats } = applyDeclarativeFeatures(feats, char, {});
    expect(stats.instinct).toBe(1);
  });

  it('does not apply when the relic is not in inventory', () => {
    const char = mockCharacter({
      traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
      inventory: [],
    });
    const feats = loadCharacterFeatures(char, registry);
    const { stats } = applyDeclarativeFeatures(feats, char, {});
    expect(stats.instinct).toBe(0);
  });
});
