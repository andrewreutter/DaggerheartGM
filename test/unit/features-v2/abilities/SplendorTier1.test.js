import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { BoltBeacon } from '../../../../src/features-v2/abilities/Splendor/BoltBeacon.js';
import { MendingTouch } from '../../../../src/features-v2/abilities/Splendor/MendingTouch.js';
import { Reassurance } from '../../../../src/features-v2/abilities/Splendor/Reassurance.js';
import { FinalWords } from '../../../../src/features-v2/abilities/Splendor/FinalWords.js';
import { HealingHands } from '../../../../src/features-v2/abilities/Splendor/HealingHands.js';
import { SecondWind } from '../../../../src/features-v2/abilities/Splendor/SecondWind.js';
import { VoiceOfReason } from '../../../../src/features-v2/abilities/Splendor/VoiceOfReason.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll, runReviewAction, runIntent } from '../helpers.js';

function freeActionTable(charId, featureKey) {
  return buildTableSnapshot(
    mockGameState({
      activeElements: [mockCharacter({ instanceId: charId, spellcastTrait: 'presence', traits: { presence: 2 } })],
      _ownerInstanceId: charId,
      _featureKey: featureKey,
      action: {
        type: 'free',
        actorInstanceId: charId,
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    })
  );
}

describe('Splendor Tier 1 — Bolt Beacon', () => {
  it('card queues Spellcast actionLoop vs Far (on-success Hope spend in loop text)', () => {
    const tbl = freeActionTable('b1', 'Bolt Beacon');
    const chips = collectChips([{ ...BoltBeacon, _ownerInstanceId: 'b1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Bolt Beacon', trait: 'Presence' }),
      })
    );
  });
});

describe('Splendor Tier 1 — Mending Touch', () => {
  it('main card costs 2 Hope and queues actionLoop', () => {
    const tbl = freeActionTable('m1', 'Mending Touch');
    const chips = collectChips([{ ...MendingTouch, _ownerInstanceId: 'm1' }], 'card', tbl);
    const main = chips.find((c) => c.name === 'Mending Touch');
    expect(main?.hopeCost).toBe(2);
    const m = activateChip(main, tbl, makeChipState());
    deductChipCosts(main, tbl);
    const fromCost = applyMutations(tbl);
    expect([...m, ...fromCost]).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'm1', amount: 2 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Mending Touch' }),
      })
    );
  });

  it('Deeper Understanding sub-card is once per long rest, costs 2 Hope, queues actionLoop', () => {
    const tbl = freeActionTable('m2', 'Mending Touch');
    const chips = collectChips([{ ...MendingTouch, _ownerInstanceId: 'm2' }], 'card', tbl);
    const sub = chips.find((c) => c.name === 'Mending Touch — Deeper Understanding');
    expect(sub?.frequency).toBe('longRest');
    expect(sub?.hopeCost).toBe(2);
    const m = activateChip(sub, tbl, makeChipState());
    deductChipCosts(sub, tbl);
    const fromCost = applyMutations(tbl);
    expect([...m, ...fromCost]).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'm2', amount: 2 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Mending Touch — Deeper Understanding' }),
      })
    );
  });
});

describe('Splendor Tier 1 — Reassurance', () => {
  it('reviewAction chip is available when an ally (not you) made the action roll', () => {
    const { chips } = runReviewAction(
      { ...Reassurance, _ownerInstanceId: 'c2' },
      {
        activeElements: [mockCharacter({ instanceId: 'c1' }), mockCharacter({ instanceId: 'c2' })],
        _ownerInstanceId: 'c2',
        action: {
          actorInstanceId: 'c1',
          targetInstanceIds: ['adv-1'],
        },
      }
    );
    expect(chips).toContainEqual(expect.objectContaining({ name: 'Reassurance', frequency: 'rest' }));
  });

  it('reviewAction chip is hidden when you are the actor', () => {
    const { chips } = runReviewAction(
      { ...Reassurance, _ownerInstanceId: 'c1' },
      {
        activeElements: [mockCharacter({ instanceId: 'c1' }), mockCharacter({ instanceId: 'c2' })],
        _ownerInstanceId: 'c1',
        action: {
          actorInstanceId: 'c1',
          targetInstanceIds: ['adv-1'],
        },
      }
    );
    expect(chips.filter((c) => c.name === 'Reassurance')).toHaveLength(0);
  });
});

describe('Splendor Tier 1 — Final Words', () => {
  it('card queues Spellcast (13) actionLoop', () => {
    const tbl = freeActionTable('f1', 'Final Words');
    const chips = collectChips([{ ...FinalWords, _ownerInstanceId: 'f1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Final Words', difficulty: 13, trait: 'Presence' }),
      })
    );
  });
});

describe('Splendor Tier 1 — Healing Hands', () => {
  it('card queues Spellcast (13) actionLoop with Melee targeting rules', () => {
    const tbl = freeActionTable('h1', 'Healing Hands');
    const chips = collectChips([{ ...HealingHands, _ownerInstanceId: 'h1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Healing Hands', difficulty: 13, trait: 'Presence' }),
      })
    );
  });
});

describe('Splendor Tier 1 — Second Wind', () => {
  it('reviewAction chip appears after a successful attack vs an adversary', () => {
    const { chips } = runReviewAction(
      { ...SecondWind, _ownerInstanceId: 'char-1' },
      { rolls: mockRoll({ hopeValue: 10, fearValue: 4, isSuccess: true }) }
    );
    expect(chips.some((c) => c.name === 'Second Wind')).toBe(true);
  });

  it('reviewAction chip does not appear for spellcast actions', () => {
    const { chips } = runReviewAction(
      { ...SecondWind, _ownerInstanceId: 'char-1' },
      { actionType: 'spellcast', rolls: mockRoll({ hopeValue: 10, fearValue: 4, isSuccess: true }) }
    );
    expect(chips.filter((c) => c.name === 'Second Wind')).toHaveLength(0);
  });

  it('reviewAction chip is hidden when the attack roll fails', () => {
    const { chips } = runReviewAction(
      { ...SecondWind, _ownerInstanceId: 'char-1' },
      { rolls: mockRoll({ isSuccess: false }) }
    );
    expect(chips.filter((c) => c.name === 'Second Wind')).toHaveLength(0);
  });

  it('activating Second Wind queues actionLoop for GM (self clear + optional ally when Hope dominant)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Second Wind',
        rolls: mockRoll({ hopeValue: 10, fearValue: 3, isSuccess: true }),
      })
    );
    const chips = collectChips([{ ...SecondWind, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const sw = chips.find((c) => c.name === 'Second Wind');
    expect(sw?.name).toBe('Second Wind');
    const m = activateChip(sw, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Second Wind' }),
      })
    );
  });
});

describe('Splendor Tier 1 — Voice of Reason', () => {
  it('onIntent adds +1 damage static when all Stress slots are marked', () => {
    const stressed = mockCharacter({ instanceId: 'char-1', currentStress: 6, maxStress: 6 });
    const { mutations } = runIntent(
      { ...VoiceOfReason, _ownerInstanceId: 'char-1' },
      {
        activeElements: [stressed, mockAdversary()],
        rolls: mockRoll(),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Voice of Reason',
          value: 1,
        }),
      })
    );
  });

  it('onIntent does not add damage static when Stress is not maxed', () => {
    const calm = mockCharacter({ instanceId: 'char-1', currentStress: 2, maxStress: 6 });
    const { mutations } = runIntent(
      { ...VoiceOfReason, _ownerInstanceId: 'char-1' },
      {
        activeElements: [calm, mockAdversary()],
        rolls: mockRoll(),
      }
    );
    expect(
      mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Voice of Reason')
    ).toHaveLength(0);
  });
});
