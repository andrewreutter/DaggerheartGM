import { describe, it, expect } from 'vitest';
import { Greedy } from '../../../../src/features-v2/weapon_properties/Greedy.js';
import {
  runReviewAction,
  mockRoll,
  mockAction,
  mockTable,
  mockChipState,
  mockCharacter,
  mockAdversary,
} from '../helpers.js';
import { activateChip, deductChipCosts, collectChips } from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, GOLD_COINS_PER_HANDFUL } from '../../../../src/features-v2/engine/table.js';

describe('Greedy', () => {
  it('shows a reviewAction chip on a successful attack when the actor has enough gold', () => {
    const { chips } = runReviewAction(Greedy, {
      activeElements: [mockCharacter({ instanceId: 'char-1', gold: 20 }), mockAdversary()],
      rolls: mockRoll({ isSuccess: true }),
      action: mockAction({ type: 'attack' }),
    });

    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0].goldCost).toBe(GOLD_COINS_PER_HANDFUL);
  });

  it('onUse adds +1 static to damage roll', () => {
    const table = mockTable({
      activeElements: [mockCharacter({ instanceId: 'char-1', gold: 20 }), mockAdversary()],
      rolls: mockRoll({ isSuccess: true }),
      action: mockAction({ type: 'attack' }),
    });

    const chips = collectChips([{ ...Greedy, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    const chip = chips[0];
    const mutations = activateChip(chip, table, mockChipState());
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Greedy', value: 1 }),
      })
    );
  });

  it('deductChipCosts queues spendGold for goldCost', () => {
    const table = mockTable({
      activeElements: [mockCharacter({ instanceId: 'char-1', gold: 20 }), mockAdversary()],
      rolls: mockRoll({ isSuccess: true }),
      action: mockAction({ type: 'attack' }),
    });
    const chips = collectChips([{ ...Greedy, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    deductChipCosts(chips[0], table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendGold',
        payload: { instanceId: 'char-1', amount: GOLD_COINS_PER_HANDFUL },
      })
    );
  });

  it('disables the chip when gold is below one handful', () => {
    const table = mockTable({
      activeElements: [
        mockCharacter({ instanceId: 'char-1', gold: GOLD_COINS_PER_HANDFUL - 1 }),
        mockAdversary(),
      ],
      rolls: mockRoll({ isSuccess: true }),
      action: mockAction({ type: 'attack' }),
    });
    const chips = collectChips([{ ...Greedy, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    expect(chips[0].disabled).toBe(true);
  });

  it('does not show the chip when the attack fails', () => {
    const { chips } = runReviewAction(Greedy, {
      rolls: mockRoll({ isSuccess: false }),
      action: mockAction({ type: 'attack' }),
    });
    expect(chips).toHaveLength(0);
  });
});
