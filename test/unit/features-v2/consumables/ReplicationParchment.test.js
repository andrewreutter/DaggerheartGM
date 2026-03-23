import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { ReplicationParchment } from '../../../../src/features-v2/consumables/ReplicationParchment.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Consumables — Replication Parchment', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Replication Parchment', id: 'srd-cns-replication-parchment' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Replication Parchment',
        description: ReplicationParchment.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-replication-parchment',
      })
    );
  });

  it('has no default card automation (narrative-only)', () => {
    expect(ReplicationParchment.onUse).toBeUndefined();
  });
});
