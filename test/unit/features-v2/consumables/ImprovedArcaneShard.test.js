import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { ImprovedArcaneShard } from '../../../../src/features-v2/consumables/ImprovedArcaneShard.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Consumables — Improved Arcane Shard', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Improved Arcane Shard', id: 'srd-cns-improved-arcane-shard' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Improved Arcane Shard',
        description: ImprovedArcaneShard.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-improved-arcane-shard',
      })
    );
  });

  it('onUse queues Finesse actionLoop for Far-range group throw', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Improved Arcane Shard',
      })
    );
    ImprovedArcaneShard.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Improved Arcane Shard',
          trait: 'Finesse',
          description: expect.stringMatching(/Finesse roll.*Far range/i),
        }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          description: expect.stringMatching(/2d20.*magic damage/i),
        }),
      })
    );
  });
});
