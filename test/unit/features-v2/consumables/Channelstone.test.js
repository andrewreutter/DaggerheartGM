import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { Channelstone } from '../../../../src/features-v2/consumables/Channelstone.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Consumables — Channelstone', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Channelstone', id: 'srd-cns-channelstone' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Channelstone',
        description: Channelstone.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-channelstone',
      })
    );
  });

  it('has no default card automation (narrative-only)', () => {
    expect(Channelstone.onUse).toBeUndefined();
  });
});
