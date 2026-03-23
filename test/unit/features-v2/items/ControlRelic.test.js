import { describe, it, expect } from 'vitest';
import {
  applyDeclarativeFeatures,
  loadCharacterFeatures,
} from '../../../../src/features-v2/engine/feature-loader.js';
import { ControlRelic } from '../../../../src/features-v2/items/ControlRelic.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Control Relic', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Control Relic', id: 'srd-itm-control-relic' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Control Relic',
        description: ControlRelic.description,
        _source: 'item',
        _itemId: 'srd-itm-control-relic',
      })
    );
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Control Relic', id: 'srd-itm-control-relic' },
          { name: 'Control Relic', id: 'srd-itm-control-relic' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Control Relic').length).toBe(1);
  });

  it('adds +1 Finesse via passiveStatMods', () => {
    const char = mockCharacter({
      traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    });
    const feats = loadCharacterFeatures(
      mockCharacter({
        ...char,
        inventory: [{ name: 'Control Relic', id: 'srd-itm-control-relic' }],
      }),
      registry
    );
    const { stats } = applyDeclarativeFeatures(feats, char, {});
    expect(stats.finesse).toBe(1);
  });

  it('does not change Finesse when the relic is not in inventory', () => {
    const char = mockCharacter({
      traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
      inventory: [],
    });
    const feats = loadCharacterFeatures(char, registry);
    const { stats } = applyDeclarativeFeatures(feats, char, {});
    expect(stats.finesse).toBe(0);
  });
});
