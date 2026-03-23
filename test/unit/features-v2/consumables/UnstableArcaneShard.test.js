import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { UnstableArcaneShard } from '../../../../src/features-v2/consumables/UnstableArcaneShard.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Consumables — Unstable Arcane Shard', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Unstable Arcane Shard', id: 'srd-cns-unstable-arcane-shard' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Unstable Arcane Shard',
        description: UnstableArcaneShard.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-unstable-arcane-shard',
      })
    );
  });

  it('onUse queues Finesse actionLoop for Far-range group throw', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Unstable Arcane Shard',
      })
    );
    UnstableArcaneShard.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Unstable Arcane Shard',
          trait: 'Finesse',
          description: expect.stringMatching(/Finesse roll.*Far range/i),
        }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          description: expect.stringMatching(/1d20.*magic damage/i),
        }),
      })
    );
  });
});
