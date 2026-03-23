import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, makeChipState, deductChipCosts } from '../../../../src/features-v2/engine/chip-system.js';
import { ReapersStrike } from '../../../../src/features-v2/abilities/Blade/ReapersStrike.js';
import { mockCharacter, mockGameState, mockAdversary } from '../helpers.js';

describe("Blade Tier 3 — Reaper's Strike", () => {
  it('card chip is once per long rest with Hope cost 1', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'c1' }), mockAdversary()],
        _ownerInstanceId: 'c1',
        _featureKey: "Reaper's Strike",
        featureState: { "Reaper's Strike": {} },
        action: { type: 'free', actorInstanceId: 'c1', targetInstanceIds: [], effects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...ReapersStrike, _ownerInstanceId: 'c1' }], 'card', tbl);
    const card = chips[0];
    expect(card?.frequency).toBe('longRest');
    expect(card?.hopeCost).toBe(1);
  });

  it('onUse spends Hope and posts actionLoop for GM-facilitated attack + 5 HP', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'c1', hope: 3 }), mockAdversary()],
        _ownerInstanceId: 'c1',
        _featureKey: "Reaper's Strike",
        featureState: { "Reaper's Strike": {} },
        action: { type: 'free', actorInstanceId: 'c1', targetInstanceIds: [], effects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...ReapersStrike, _ownerInstanceId: 'c1' }], 'card', tbl);
    const card = chips[0];
    const fromUse = activateChip(card, tbl, makeChipState());
    deductChipCosts(card, tbl);
    const fromCost = applyMutations(tbl);
    const all = [...fromUse, ...fromCost];
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: "Reaper's Strike" }),
      })
    );
  });
});
