import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { AdjustReality } from '../../../../src/features-v2/abilities/Arcana/AdjustReality.js';
import { FallingSky } from '../../../../src/features-v2/abilities/Arcana/FallingSky.js';
import { mockAdversary, mockCharacter, mockGameState, mockRoll, runReviewAction } from '../helpers.js';

describe('Arcana Tier 3 — Adjust Reality', () => {
  it('reviewAction offers action and damage chips when a PC rolls', () => {
    const { chips } = runReviewAction(
      { ...AdjustReality, _ownerInstanceId: 'char-1' },
      {
        activeElements: [mockCharacter({ instanceId: 'char-1' }), mockAdversary()],
        rolls: mockRoll(),
      }
    );
    const names = chips.map((c) => c.name);
    expect(names).toContain('Adjust Reality — Action roll');
    expect(names).toContain('Adjust Reality — Damage roll');
    expect(chips.find((c) => c.name === 'Adjust Reality — Action roll')?.hopeCost).toBe(5);
  });

  it('reviewAction offers chips when an ally PC is the actor', () => {
    const owner = mockCharacter({ instanceId: 'char-1', hope: 8 });
    const ally = mockCharacter({ instanceId: 'char-2', name: 'Ally' });
    const { chips } = runReviewAction(
      { ...AdjustReality, _ownerInstanceId: 'char-1' },
      {
        activeElements: [owner, ally, mockAdversary()],
        action: { actorInstanceId: 'char-2' },
        rolls: mockRoll(),
      }
    );
    expect(chips.some((c) => c.name === 'Adjust Reality — Action roll')).toBe(true);
  });

  it('does not offer reviewAction chips when the actor is an adversary', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewAction(
      { ...AdjustReality, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: { actorInstanceId: 'adv-1' },
        rolls: mockRoll(),
      }
    );
    expect(chips.filter((c) => c.name?.startsWith('Adjust Reality'))).toHaveLength(0);
  });

  it('action chip queues actionLoop and spends 5 Hope from the feature owner', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 8 });
    const gs = mockGameState({
      activeElements: [char, mockAdversary()],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Adjust Reality',
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...AdjustReality, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const actionChip = chips.find((c) => c.name === 'Adjust Reality — Action roll');
    expect(actionChip).toBeDefined();
    const m = activateChip(actionChip, tbl, makeChipState());
    deductChipCosts(actionChip, tbl);
    const mutations = [...m, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Adjust Reality — Action roll',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 5 }),
      })
    );
  });
});

describe('Arcana Tier 3 — Falling Sky', () => {
  it('card chip has hope cost 1 (recall)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Falling Sky',
      })
    );
    const chips = collectChips([{ ...FallingSky, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(1);
  });

  it('card chip queues actionLoop on use with Spellcast trait and Far range wording', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Falling Sky',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...FallingSky, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Falling Sky',
          trait: 'Presence',
          description: expect.stringMatching(/Spellcast \(Presence\).*Far/is),
        }),
      })
    );
  });
});
