import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { KnowledgeStone } from '../../../../src/features-v2/consumables/KnowledgeStone.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Consumables — Knowledge Stone', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Knowledge Stone', id: 'srd-cns-knowledge-stone' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Knowledge Stone',
        description: KnowledgeStone.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-knowledge-stone',
      })
    );
  });

  it('has no default card automation (narrative-only)', () => {
    expect(KnowledgeStone.onUse).toBeUndefined();
  });
});
