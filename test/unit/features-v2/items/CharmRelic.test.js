import { describe, it, expect } from 'vitest';
import {
  applyDeclarativeFeatures,
  loadCharacterFeatures,
} from '../../../../src/features-v2/engine/feature-loader.js';
import { CharmRelic } from '../../../../src/features-v2/items/CharmRelic.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Charm Relic', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Charm Relic', id: 'srd-itm-charm-relic' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Charm Relic',
        description: CharmRelic.description,
        _source: 'item',
        _itemId: 'srd-itm-charm-relic',
      })
    );
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Charm Relic', id: 'srd-itm-charm-relic' },
          { name: 'Charm Relic', id: 'srd-itm-charm-relic' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Charm Relic').length).toBe(1);
  });

  it('adds +1 Presence via passiveStatMods', () => {
    const char = mockCharacter({
      traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    });
    const feats = loadCharacterFeatures(
      mockCharacter({
        ...char,
        inventory: [{ name: 'Charm Relic', id: 'srd-itm-charm-relic' }],
      }),
      registry
    );
    const { stats } = applyDeclarativeFeatures(feats, char, {});
    expect(stats.presence).toBe(1);
  });
});
