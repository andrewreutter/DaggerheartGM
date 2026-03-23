import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { Wingsprout } from '../../../../src/features-v2/consumables/Wingsprout.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Consumables — Wingsprout', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Wingsprout', id: 'srd-cns-wingsprout' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Wingsprout',
        description: Wingsprout.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-wingsprout',
      })
    );
  });

  it('has no default card automation (narrative-only)', () => {
    expect(Wingsprout.onUse).toBeUndefined();
  });
});
