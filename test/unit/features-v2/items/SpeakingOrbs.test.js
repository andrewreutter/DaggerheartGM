import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { SpeakingOrbs } from '../../../../src/features-v2/items/SpeakingOrbs.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Speaking Orbs', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Speaking Orbs', id: 'srd-itm-speaking-orbs' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Speaking Orbs',
        description: SpeakingOrbs.description,
        _source: 'item',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Speaking Orbs' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Speaking Orbs' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Speaking Orbs', id: 'srd-itm-speaking-orbs' },
          { name: 'Speaking Orbs', id: 'srd-itm-speaking-orbs' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Speaking Orbs').length).toBe(1);
  });
});
