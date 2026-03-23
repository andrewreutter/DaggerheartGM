import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import {
  collectChips,
  activateChip,
  makeChipState,
  deductChipCosts,
} from '../../../../src/features-v2/engine/chip-system.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { ParagonsChain } from '../../../../src/features-v2/items/ParagonsChain.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll } from '../helpers.js';

describe("Items — Paragon's Chain", () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: "Paragon's Chain", id: 'srd-itm-paragon-s-chain' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: "Paragon's Chain",
        description: ParagonsChain.description,
        _source: 'item',
        _itemId: 'srd-itm-paragon-s-chain',
      })
    );
  });

  it('intent chip is once per long rest, costs 1 Hope, sets d20 Hope die', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 3 });
    const gs = mockGameState({
      activeElements: [char, mockAdversary()],
      _ownerInstanceId: 'char-1',
      _featureKey: "Paragon's Chain",
      featureState: { "Paragon's Chain": {} },
      action: { type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'], effects: [] },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ParagonsChain, _ownerInstanceId: 'char-1' }], 'intent', tbl);
    expect(chips).toHaveLength(1);
    expect(chips[0].frequency).toBe('longRest');
    expect(chips[0].hopeCost).toBe(1);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const fromCost = applyMutations(tbl);
    const m = [...fromUse, ...fromCost];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setDie',
        payload: expect.objectContaining({ dieType: 'hopeDie', die: 'd20' }),
      })
    );
  });
});
