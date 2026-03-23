import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { Acidpaste } from '../../../../src/features-v2/consumables/Acidpaste.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Consumables — Acidpaste', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Acidpaste', id: 'srd-cns-acidpaste' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Acidpaste',
        description: Acidpaste.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-acidpaste',
      })
    );
  });

  it('has no default card automation (narrative-only)', () => {
    expect(Acidpaste.onUse).toBeUndefined();
  });
});
