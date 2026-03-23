import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  makeChipState,
  deductChipCosts,
} from '../../../../src/features-v2/engine/chip-system.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { Recovery } from '../../../../src/features-v2/abilities/Bone/Recovery.js';
import { mockCharacter, mockGameState } from '../helpers.js';
import { buildTableSnapshot, applyMutations as applyTableMutations } from '../../../../src/features-v2/engine/table.js';

function cardTable(charId) {
  const c = mockCharacter({ instanceId: charId });
  return buildTableSnapshot(
    mockGameState({
      character: c,
      activeElements: [c],
      currentActorInstanceId: charId,
      _ownerInstanceId: charId,
    })
  );
}

describe('Bone — Recovery', () => {
  it('applyDeclarativeFeatures adds numLongMovesInShortRest', () => {
    const char = mockCharacter({ instanceId: 'rec1' });
    const { stats } = applyDeclarativeFeatures([{ ...Recovery, _ownerInstanceId: 'rec1' }], char, {});
    expect(stats.numLongMovesInShortRest).toBe(1);
  });

  it('card chip spends 1 Hope and queues actionLoop for ally long-rest choice', () => {
    const tbl = cardTable('rec1');
    const chips = collectChips([{ ...Recovery, _ownerInstanceId: 'rec1' }], 'card', tbl);
    const card = chips.find((c) => c.name === 'Recovery — Ally');
    expect(card).toBeDefined();
    const fromUse = activateChip(card, tbl, makeChipState());
    deductChipCosts(card, tbl);
    const m = [...fromUse, ...applyTableMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Recovery' }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({ type: 'spendHope', payload: expect.objectContaining({ amount: 1 }) })
    );
  });
});
