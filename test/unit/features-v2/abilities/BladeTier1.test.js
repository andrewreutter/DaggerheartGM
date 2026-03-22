import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { GetBackUp } from '../../../../src/features-v2/abilities/Blade/GetBackUp.js';
import { NotGoodEnough } from '../../../../src/features-v2/abilities/Blade/NotGoodEnough.js';
import { Whirlwind } from '../../../../src/features-v2/abilities/Blade/Whirlwind.js';
import { ASoldiersBond } from '../../../../src/features-v2/abilities/Blade/ASoldiersBond.js';
import { Reckless } from '../../../../src/features-v2/abilities/Blade/Reckless.js';
import { Scramble } from '../../../../src/features-v2/abilities/Blade/Scramble.js';
import { VersatileFighter } from '../../../../src/features-v2/abilities/Blade/VersatileFighter.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockRoll,
  runIntent,
  runReviewAction,
  runReviewOutcome,
} from '../helpers.js';

describe('Blade Tier 1 — Get Back Up', () => {
  it('shows reviewOutcome chip when incoming HP loss is Severe (amount ≥ 3)', () => {
    const char = mockCharacter({ instanceId: 'b1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewOutcome(
      { ...GetBackUp, _ownerInstanceId: 'b1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'b1',
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['b1'],
          effects: [{ stat: 'currentHP', target: char, amount: 3, source: adv }],
        },
      }
    );
    expect(chips).toHaveLength(1);
    expect(chips[0].placements).toContain('reviewOutcome');
    expect(chips[0].stressCost).toBe(1);
  });

  it('shows chip when damageTier is severe', () => {
    const char = mockCharacter({ instanceId: 'b1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewOutcome(
      { ...GetBackUp, _ownerInstanceId: 'b1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'b1',
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['b1'],
          effects: [
            { stat: 'currentHP', target: char, amount: 2, damageTier: 'severe', source: adv },
          ],
        },
      }
    );
    expect(chips).toHaveLength(1);
  });

  it('does not show chip when HP loss is below Severe (amount 2, no tier)', () => {
    const char = mockCharacter({ instanceId: 'b1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewOutcome(
      { ...GetBackUp, _ownerInstanceId: 'b1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'b1',
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['b1'],
          effects: [{ stat: 'currentHP', target: char, amount: 2, source: adv }],
        },
      }
    );
    expect(chips).toHaveLength(0);
  });

  it('onUse reduces pending HP loss by one and stress cost applies', () => {
    const char = mockCharacter({ instanceId: 'b1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ stat: 'currentHP', target: char, amount: 4, source: adv }];
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'b1',
      _featureKey: 'Get Back Up',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['b1'],
        effects,
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...GetBackUp, _ownerInstanceId: 'b1' }], 'reviewOutcome', tbl);
    expect(chips).toHaveLength(1);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(effects[0].amount).toBe(3);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'b1', amount: 1 }),
      })
    );
  });
});

describe('Blade Tier 1 — Not Good Enough', () => {
  it('shows reviewAction chip when a damage die shows 1 or 2', () => {
    const { chips } = runReviewAction(
      { ...NotGoodEnough, _ownerInstanceId: 'b1' },
      {
        activeElements: [mockCharacter({ instanceId: 'b1' }), mockAdversary()],
        _ownerInstanceId: 'b1',
        action: { type: 'attack', actorInstanceId: 'b1', targetInstanceIds: ['adv-1'] },
        rolls: mockRoll({
          damageDice: [
            { name: 'weapon', die: 'd8', value: 1 },
            { name: 'bonus', die: 'd6', value: 6 },
          ],
        }),
      }
    );
    expect(chips.some((c) => c.placements?.includes('reviewAction') && c.onUse)).toBe(true);
  });

  it('does not show chip when all damage dice are 3+', () => {
    const { chips } = runReviewAction(
      { ...NotGoodEnough, _ownerInstanceId: 'b1' },
      {
        _ownerInstanceId: 'b1',
        action: { type: 'attack', actorInstanceId: 'b1', targetInstanceIds: ['adv-1'] },
        rolls: mockRoll({
          damageDice: [
            { name: 'weapon', die: 'd8', value: 5 },
            { name: 'bonus', die: 'd6', value: 4 },
          ],
        }),
      }
    );
    expect(chips.filter((c) => c.placements?.includes('reviewAction') && c.onUse)).toHaveLength(0);
  });

  it('onUse queues reroll for low faces', () => {
    const self = mockCharacter({ instanceId: 'b1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips: phaseChips } = runReviewAction(
      { ...NotGoodEnough, _ownerInstanceId: 'b1' },
      {
        activeElements: [self, adv],
        _ownerInstanceId: 'b1',
        action: { type: 'attack', actorInstanceId: 'b1', targetInstanceIds: ['adv-1'] },
        rolls: mockRoll({
          damageDice: [
            { name: 'w', die: 'd8', value: 2 },
            { name: 'x', die: 'd6', value: 5 },
          ],
        }),
      }
    );
    const gs = mockGameState({
      activeElements: [self, adv],
      _ownerInstanceId: 'b1',
      _featureKey: 'Not Good Enough',
      action: { type: 'attack', actorInstanceId: 'b1', targetInstanceIds: ['adv-1'] },
      rolls: mockRoll({
        damageDice: [
          { name: 'w', die: 'd8', value: 2 },
          { name: 'x', die: 'd6', value: 5 },
        ],
      }),
    });
    const tbl = buildTableSnapshot(gs);
    const lowChip = phaseChips.find((c) => c.placements?.includes('reviewAction') && c.onUse);
    const m = activateChip(lowChip, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: expect.objectContaining({ rollKey: 'damage', dieName: 'w' }),
      })
    );
  });
});

describe('Blade Tier 1 — Whirlwind', () => {
  it('queues actionLoop after successful attack from Very Close', () => {
    const char = mockCharacter({ instanceId: 'b1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 8, tokenY: 0 });
    const { chips } = runReviewAction(
      { ...Whirlwind, _ownerInstanceId: 'b1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'b1',
        action: {
          type: 'attack',
          actorInstanceId: 'b1',
          targetInstanceIds: ['adv-1'],
        },
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    const ww = chips.find((c) => c.name === 'Whirlwind');
    expect(ww).toBeDefined();
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'b1',
      _featureKey: 'Whirlwind',
      action: {
        type: 'attack',
        actorInstanceId: 'b1',
        targetInstanceIds: ['adv-1'],
      },
      rolls: mockRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const m = activateChip(ww, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Whirlwind' }),
      })
    );
  });
});

describe("Blade Tier 1 — A Soldier's Bond", () => {
  it('card has longRest frequency and selectTargets excludes self', () => {
    expect(ASoldiersBond.chips[0].frequency).toBe('longRest');
    const ally = mockCharacter({ instanceId: 'ally', name: 'Ally' });
    const self = mockCharacter({ instanceId: 'b1', name: 'Me' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [self, ally],
        _ownerInstanceId: 'b1',
      })
    );
    const targets = ASoldiersBond.chips[0].selectTargets(tbl);
    expect(targets.map((t) => t.instanceId)).toEqual(['ally']);
  });

  it('gainHope for self and selected ally', () => {
    const self = mockCharacter({ instanceId: 'b1', hope: 2 });
    const ally = mockCharacter({ instanceId: 'ally', hope: 1 });
    const gs = mockGameState({
      activeElements: [self, ally],
      _ownerInstanceId: 'b1',
      _featureKey: "A Soldier's Bond",
    });
    const tbl = buildTableSnapshot(gs);
    const chip = ASoldiersBond.chips[0];
    const st = makeChipState();
    st.set('selectedTargetIds', ['ally']);
    const m = [...activateChip(chip, tbl, st), ...applyMutations(tbl)];
    expect(m.filter((x) => x.type === 'gainHope').length).toBeGreaterThanOrEqual(1);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'b1', amount: 3 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'ally', amount: 3 }),
      })
    );
  });
});

describe('Blade Tier 1 — Reckless', () => {
  it('intent chip adds advantage die on attack', () => {
    const self = mockCharacter({ instanceId: 'b1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runIntent(
      { ...Reckless, _ownerInstanceId: 'b1' },
      {
        activeElements: [self, adv],
        currentActorInstanceId: 'b1',
        _ownerInstanceId: 'b1',
        action: { type: 'attack', actorInstanceId: 'b1', targetInstanceIds: ['adv-1'] },
        rolls: mockRoll(),
      }
    );
    const r = chips.find((c) => c.placements?.includes('intent') && c.stressCost === 1);
    expect(r).toBeDefined();
    const gs = mockGameState({
      activeElements: [self, adv],
      currentActorInstanceId: 'b1',
      _ownerInstanceId: 'b1',
      _featureKey: 'Reckless',
      action: { type: 'attack', actorInstanceId: 'b1', targetInstanceIds: ['adv-1'] },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const fromUse = activateChip(r, tbl, makeChipState());
    deductChipCosts(r, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addAdvantageDie',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Reckless' }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'b1', amount: 1 }),
      })
    );
  });

  it('does not offer chip when not attacking', () => {
    const self = mockCharacter({ instanceId: 'b1' });
    const { chips } = runIntent(
      { ...Reckless, _ownerInstanceId: 'b1' },
      {
        activeElements: [self, mockAdversary()],
        currentActorInstanceId: 'b1',
        _ownerInstanceId: 'b1',
        action: { type: 'trait', actorInstanceId: 'b1', targetInstanceIds: [] },
        rolls: mockRoll(),
      }
    );
    expect(chips.filter((c) => c.placements?.includes('intent') && c.stressCost === 1)).toHaveLength(0);
  });
});

describe('Blade Tier 1 — Scramble', () => {
  it('shows reviewAction chip when targeted by Melee damage', () => {
    const char = mockCharacter({ instanceId: 'b1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 4, tokenY: 0 });
    const { chips } = runReviewAction(
      { ...Scramble, _ownerInstanceId: 'b1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'b1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['b1'],
          effects: [
            { type: 'damage', target: { instanceId: 'b1' }, amount: 4, damageType: 'physical' },
          ],
        },
      }
    );
    expect(chips.some((c) => c.name === 'Scramble')).toBe(true);
  });

  it('does not show chip when attacker is not in Melee range', () => {
    const char = mockCharacter({ instanceId: 'b1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 80, tokenY: 0 });
    const { chips } = runReviewAction(
      { ...Scramble, _ownerInstanceId: 'b1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'b1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['b1'],
          effects: [
            { type: 'damage', target: { instanceId: 'b1' }, amount: 4, damageType: 'physical' },
          ],
        },
      }
    );
    expect(chips.filter((c) => c.name === 'Scramble')).toHaveLength(0);
  });

  it('onUse clears pending damage and queues narration', () => {
    const char = mockCharacter({ instanceId: 'b1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 4, tokenY: 0 });
    const effects = [
      { type: 'damage', target: { instanceId: 'b1' }, amount: 4, damageType: 'physical' },
    ];
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'b1',
      _featureKey: 'Scramble',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['b1'],
        effects,
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Scramble, _ownerInstanceId: 'b1' }], 'reviewAction', tbl);
    const sc = chips.find((c) => c.name === 'Scramble');
    expect(sc).toBeDefined();
    const m = [...activateChip(sc, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(effects[0].amount).toBe(0);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addNarration',
        payload: expect.objectContaining({ text: expect.stringContaining('Scramble') }),
      })
    );
  });
});

describe('Blade Tier 1 — Versatile Fighter', () => {
  it('card queues actionLoop for trait declaration', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'b1' })],
        _ownerInstanceId: 'b1',
        _featureKey: 'Versatile Fighter',
        action: { type: 'free', actorInstanceId: 'b1', targetInstanceIds: [], effects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...VersatileFighter, _ownerInstanceId: 'b1' }], 'card', tbl);
    const card = chips.find((c) => c.name === 'Versatile Fighter — weapon trait');
    expect(card).toBeDefined();
    const m = activateChip(card, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Versatile Fighter' }),
      })
    );
  });

  it('reviewAction max chip sets chosen die to max face and marks Stress', () => {
    const char = mockCharacter({ instanceId: 'b1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'b1',
      _featureKey: 'Versatile Fighter',
      action: { type: 'attack', actorInstanceId: 'b1', targetInstanceIds: ['adv-1'] },
      rolls: mockRoll({
        damageDice: [
          { name: 'weapon', die: 'd8', value: 3 },
          { name: 'bonus', die: 'd6', value: 2 },
        ],
      }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...VersatileFighter, _ownerInstanceId: 'b1' }], 'reviewAction', tbl);
    const maxChip = chips.find((c) => c.name === 'Versatile Fighter — max die');
    expect(maxChip).toBeDefined();
    const fromUse = activateChip(maxChip, tbl, makeChipState(), { selectedId: 'weapon' });
    deductChipCosts(maxChip, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({ rollKey: 'damage', die: 'd8', name: 'weapon', value: 8 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'b1', amount: 1 }),
      })
    );
  });

  it('does not offer max die chip without damage dice', () => {
    const { chips } = runReviewAction(
      { ...VersatileFighter, _ownerInstanceId: 'b1' },
      {
        _ownerInstanceId: 'b1',
        action: { type: 'attack', actorInstanceId: 'b1', targetInstanceIds: ['adv-1'] },
        rolls: mockRoll({ damageDice: [] }),
      }
    );
    expect(chips.filter((c) => c.name === 'Versatile Fighter — max die')).toHaveLength(0);
  });
});
