import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { BoxOfManyGoods } from '../../../../src/features-v2/items/BoxOfManyGoods.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Items — Box of Many Goods', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Box of Many Goods', id: 'srd-itm-box-of-many-goods' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Box of Many Goods',
        description: BoxOfManyGoods.description,
        _source: 'item',
        _itemId: 'srd-itm-box-of-many-goods',
      })
    );
  });

  it('card chip is once per long rest and opens actionLoop with d12 instructions', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Box of Many Goods',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...BoxOfManyGoods, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    expect(chips[0].frequency).toBe('longRest');

    deductChipCosts(chips[0], tbl);
    const fromUse = [...activateChip(chips[0], tbl, makeChipState()), ...applyMutations(tbl)];

    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Box of Many Goods',
          description: expect.stringMatching(/roll a d12/i),
        }),
      })
    );
  });

  it('does not expose intent-phase chips', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Box of Many Goods',
    });
    const tbl = buildTableSnapshot(gs);
    const intent = collectChips([{ ...BoxOfManyGoods, _ownerInstanceId: 'char-1' }], 'intent', tbl);
    expect(intent).toHaveLength(0);
  });
});
