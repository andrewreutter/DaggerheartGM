import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { ShardOfMemory } from '../../../../src/features-v2/items/ShardOfMemory.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Items — Shard of Memory', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Shard of Memory', id: 'srd-itm-shard-of-memory' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Shard of Memory',
        description: ShardOfMemory.description,
        _source: 'item',
        _itemId: 'srd-itm-shard-of-memory',
      })
    );
  });

  it('card chip is once per long rest, costs 2 Hope, and posts actionLoop for vault recall', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 4 });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Shard of Memory',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ShardOfMemory, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    expect(chips[0].frequency).toBe('longRest');
    expect(chips[0].hopeCost).toBe(2);

    deductChipCosts(chips[0], tbl);
    const fromUse = [...activateChip(chips[0], tbl, makeChipState()), ...applyMutations(tbl)];

    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 2 }),
      })
    );
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Shard of Memory',
          description: expect.stringMatching(/vault/i),
        }),
      })
    );
  });

  it('does not expose intent-phase chips', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Shard of Memory',
    });
    const tbl = buildTableSnapshot(gs);
    const intent = collectChips([{ ...ShardOfMemory, _ownerInstanceId: 'char-1' }], 'intent', tbl);
    expect(intent).toHaveLength(0);
  });
});
