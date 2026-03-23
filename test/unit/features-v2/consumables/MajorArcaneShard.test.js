import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { MajorArcaneShard } from '../../../../src/features-v2/consumables/MajorArcaneShard.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Consumables — Major Arcane Shard', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Major Arcane Shard', id: 'srd-cns-major-arcane-shard' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Major Arcane Shard',
        description: MajorArcaneShard.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-major-arcane-shard',
      })
    );
  });

  it('does not load when inventory lacks this consumable', () => {
    const feats = loadCharacterFeatures(mockCharacter({ inventory: [] }), registry);
    expect(feats.some((f) => f.name === 'Major Arcane Shard')).toBe(false);
  });

  it('onUse queues Finesse actionLoop for Far-range group throw', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Major Arcane Shard',
      })
    );
    MajorArcaneShard.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Major Arcane Shard',
          trait: 'Finesse',
          description: expect.stringMatching(/Finesse roll.*Far range/i),
        }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          description: expect.stringMatching(/4d20.*magic damage/i),
        }),
      })
    );
  });
});
