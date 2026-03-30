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
import { HealingStrike } from '../../../../src/features-v2/abilities/Splendor/HealingStrike.js';
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

function mendingTouchTable(casterId, allyId) {
  return buildTableSnapshot(
    mockGameState({
      activeElements: [
        mockCharacter({
          instanceId: casterId,
          hope: 4,
          spellcastTrait: 'presence',
          traits: { presence: 2 },
        }),
        mockCharacter({
          instanceId: allyId,
          currentHp: 2,
          maxHp: 6,
          currentStress: 3,
          maxStress: 6,
        }),
      ],
      _ownerInstanceId: casterId,
      _featureKey: 'Mending Touch',
      action: {
        type: 'free',
        actorInstanceId: casterId,
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    })
  );
}

function mendingTouchTableThree(casterId, allyDamagedId, allyFullId) {
  return buildTableSnapshot(
    mockGameState({
      activeElements: [
        mockCharacter({
          instanceId: casterId,
          hope: 4,
          spellcastTrait: 'presence',
          traits: { presence: 2 },
        }),
        mockCharacter({
          instanceId: allyDamagedId,
          currentHp: 3,
          maxHp: 6,
          currentStress: 2,
          maxStress: 6,
        }),
        mockCharacter({
          instanceId: allyFullId,
          currentHp: 6,
          maxHp: 6,
          currentStress: 0,
          maxStress: 6,
        }),
      ],
      _ownerInstanceId: casterId,
      _featureKey: 'Mending Touch',
      action: {
        type: 'free',
        actorInstanceId: casterId,
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    })
  );
}

describe('Splendor Tier 1 — Mending Touch', () => {
  it('selectTargets lists other PCs only, not self', () => {
    const tbl = mendingTouchTable('m-cast', 'm-ally');
    const chips = collectChips([{ ...MendingTouch, _ownerInstanceId: 'm-cast' }], 'card', tbl);
    const clearStress = chips.find((c) => c.name === 'Mending Touch — 1 Stress');
    const targets = clearStress?.selectTargets?.(tbl) ?? [];
    const ids = targets.map((t) => t.instanceId);
    expect(ids).toContain('m-ally');
    expect(ids).not.toContain('m-cast');
  });

  it('Clear Hit Point selectTargets omits allies at full HP (no marked HP)', () => {
    const tbl = mendingTouchTableThree('cast-hp', 'ally-hurt', 'ally-full');
    const chips = collectChips([{ ...MendingTouch, _ownerInstanceId: 'cast-hp' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Mending Touch — 1 HP');
    const ids = (chip?.selectTargets?.(tbl) ?? []).map((t) => t.instanceId);
    expect(ids).toContain('ally-hurt');
    expect(ids).not.toContain('ally-full');
  });

  it('Clear Stress selectTargets omits allies with no marked Stress', () => {
    const tbl = mendingTouchTableThree('cast-st', 'ally-hurt', 'ally-full');
    const chips = collectChips([{ ...MendingTouch, _ownerInstanceId: 'cast-st' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Mending Touch — 1 Stress');
    const ids = (chip?.selectTargets?.(tbl) ?? []).map((t) => t.instanceId);
    expect(ids).toContain('ally-hurt');
    expect(ids).not.toContain('ally-full');
  });

  it('Deeper Clear Hit Points selectTargets requires at least 2 marked HP', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [
          mockCharacter({ instanceId: 'cast-d', hope: 4, spellcastTrait: 'presence', traits: { presence: 2 } }),
          mockCharacter({
            instanceId: 'ally-1hp',
            currentHp: 5,
            maxHp: 6,
            currentStress: 0,
            maxStress: 6,
          }),
        ],
        _ownerInstanceId: 'cast-d',
        _featureKey: 'Mending Touch',
        action: {
          type: 'free',
          actorInstanceId: 'cast-d',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...MendingTouch, _ownerInstanceId: 'cast-d' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Deeper Understanding — 2 HP');
    const ids = (chip?.selectTargets?.(tbl) ?? []).map((t) => t.instanceId);
    expect(ids).toHaveLength(0);
  });

  it('Clear Stress spends 2 Hope and clears 1 Stress on chosen ally', () => {
    const tbl = mendingTouchTable('m1', 'ally-1');
    const chips = collectChips([{ ...MendingTouch, _ownerInstanceId: 'm1' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Mending Touch — 1 Stress');
    expect(chip?.hopeCost).toBe(2);
    const m = activateChip(chip, tbl, makeChipState(), { selectedTargetIds: ['ally-1'] });
    deductChipCosts(chip, tbl);
    const fromCost = applyMutations(tbl);
    const all = [...m, ...fromCost];
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'm1', amount: 2 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: { instanceId: 'ally-1', amount: 1 },
      })
    );
  });

  it('Clear Hit Point spends 2 Hope and clears 1 HP on chosen ally', () => {
    const tbl = mendingTouchTable('m2', 'ally-2');
    const chips = collectChips([{ ...MendingTouch, _ownerInstanceId: 'm2' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Mending Touch — 1 HP');
    const m = activateChip(chip, tbl, makeChipState(), { selectedTargetIds: ['ally-2'] });
    deductChipCosts(chip, tbl);
    const fromCost = applyMutations(tbl);
    const all = [...m, ...fromCost];
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'm2', amount: 2 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: { instanceId: 'ally-2', amount: 1 },
      })
    );
  });

  it('Deeper Understanding — Clear Stress is long rest, spends 2 Hope, clears 2 Stress', () => {
    const tbl = mendingTouchTable('m3', 'ally-3');
    const chips = collectChips([{ ...MendingTouch, _ownerInstanceId: 'm3' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Deeper Understanding — 2 Stress');
    expect(chip?.frequency).toBe('longRest');
    expect(chip?.hopeCost).toBe(2);
    const m = activateChip(chip, tbl, makeChipState(), { selectedTargetIds: ['ally-3'] });
    deductChipCosts(chip, tbl);
    const fromCost = applyMutations(tbl);
    const all = [...m, ...fromCost];
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: { instanceId: 'ally-3', amount: 2 },
      })
    );
  });

  it('Deeper Understanding — Clear Hit Points clears 2 HP', () => {
    const tbl = mendingTouchTable('m4', 'ally-4');
    const chips = collectChips([{ ...MendingTouch, _ownerInstanceId: 'm4' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Deeper Understanding — 2 HP');
    const m = activateChip(chip, tbl, makeChipState(), { selectedTargetIds: ['ally-4'] });
    deductChipCosts(chip, tbl);
    const fromCost = applyMutations(tbl);
    const all = [...m, ...fromCost];
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: { instanceId: 'ally-4', amount: 2 },
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

describe('Splendor Tier 1 — Healing Strike', () => {
  const attacker = mockCharacter({ instanceId: 'char-1', hope: 4, tokenX: 0, tokenY: 0 });
  const allyClose = mockCharacter({ instanceId: 'ally-1', tokenX: 5, tokenY: 0, currentHp: 2, maxHp: 6 });
  const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 25, tokenY: 0 });

  it('reviewAction chip appears when pending damage targets an adversary and a damage roll exists', () => {
    const { chips } = runReviewAction(
      { ...HealingStrike, _ownerInstanceId: 'char-1' },
      {
        activeElements: [attacker, allyClose, adv],
        _ownerInstanceId: 'char-1',
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [
            { type: 'damage', amount: 4, target: { instanceId: 'adv-1', name: 'Goblin' } },
          ],
          appliedEffects: [],
        },
        rolls: mockRoll(),
      }
    );
    expect(chips.some((c) => c.name === 'Healing Strike')).toBe(true);
  });

  it('reviewAction chip is hidden when damage does not target an adversary', () => {
    const { chips } = runReviewAction(
      { ...HealingStrike, _ownerInstanceId: 'char-1' },
      {
        activeElements: [attacker, allyClose, adv],
        _ownerInstanceId: 'char-1',
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['ally-1'],
          effects: [
            { type: 'damage', amount: 2, target: { instanceId: 'ally-1', name: 'Ally' } },
          ],
          appliedEffects: [],
        },
        rolls: mockRoll(),
      }
    );
    expect(chips.filter((c) => c.name === 'Healing Strike')).toHaveLength(0);
  });

  it('reviewAction chip is hidden without a damage roll in progress', () => {
    const { chips } = runReviewAction(
      { ...HealingStrike, _ownerInstanceId: 'char-1' },
      {
        activeElements: [attacker, allyClose, adv],
        _ownerInstanceId: 'char-1',
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [
            { type: 'damage', amount: 4, target: { instanceId: 'adv-1', name: 'Goblin' } },
          ],
          appliedEffects: [],
        },
        rolls: undefined,
      }
    );
    expect(chips.filter((c) => c.name === 'Healing Strike')).toHaveLength(0);
  });

  it('activating the chip spends 2 Hope and clears 1 HP on a chosen ally within Close range', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [attacker, allyClose, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Healing Strike',
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [
            { type: 'damage', amount: 4, target: { instanceId: 'adv-1', name: 'Goblin' } },
          ],
          appliedEffects: [],
        },
        rolls: mockRoll(),
      })
    );
    const chips = collectChips([{ ...HealingStrike, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const hs = chips.find((c) => c.name === 'Healing Strike');
    expect(hs?.hopeCost).toBe(2);
    const m = activateChip(hs, tbl, makeChipState(), { selectedTargetIds: ['ally-1'] });
    deductChipCosts(hs, tbl);
    const fromCost = applyMutations(tbl);
    const all = [...m, ...fromCost];
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 2 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: { instanceId: 'ally-1', amount: 1 },
      })
    );
  });
});
