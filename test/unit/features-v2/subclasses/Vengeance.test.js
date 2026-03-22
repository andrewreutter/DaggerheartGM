import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import {
  activateChip,
  collectChips,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { AtEase, Revenge, ActOfReprisal, Nemesis } from '../../../../src/features-v2/subclasses/Vengeance.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockAction,
  mockRoll,
  runReviewAction,
  runReviewOutcome,
} from '../helpers.js';

describe('Vengeance — At Ease', () => {
  it('adds +1 max Stress via passiveStatMods', () => {
    const char = mockCharacter({ instanceId: 'g1', maxStress: 6 });
    const { stats } = applyDeclarativeFeatures([{ ...AtEase, _ownerInstanceId: 'g1' }], char, {});
    expect(stats.maxStress).toBe(7);
  });
});

describe('Vengeance — Revenge', () => {
  it('reviewAction chip marks 2 Stress on self and 1 HP on attacker when attack succeeds in melee', () => {
    const g = mockCharacter({ instanceId: 'g1', tokenX: 0, tokenY: 0, currentStress: 0, maxStress: 8 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0, currentHp: 3, maxHp: 3 });

    const rolls = {
      action: {
        gmDie: { value: 15 },
        hopeDie: null,
        fearDie: null,
        dice: [],
        statics: [],
        isSuccess: true,
        isCritical: false,
      },
      damage: {},
    };

    const { chips } = runReviewAction(
      { ...Revenge, _ownerInstanceId: 'g1' },
      {
        activeElements: [g, adv],
        _ownerInstanceId: 'g1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['g1'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
        rolls,
      }
    );

    expect(chips).toHaveLength(1);
    expect(chips[0].stressCost).toBe(2);

    const gs = mockGameState({
      activeElements: [g, adv],
      _ownerInstanceId: 'g1',
      _featureKey: 'Revenge',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['g1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls,
    });

    const tbl = buildTableSnapshot(gs);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const fromCost = applyMutations(tbl);
    const mutations = [...fromUse, ...fromCost];

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'g1', amount: 2 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markHP',
        payload: expect.objectContaining({ instanceId: 'adv-1', amount: 1 }),
      })
    );
  });

  it('does not offer Revenge when the attacker is not in Melee range', () => {
    const g = mockCharacter({ instanceId: 'g1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 200, tokenY: 0 });

    const { chips } = runReviewAction(
      { ...Revenge, _ownerInstanceId: 'g1' },
      {
        activeElements: [g, adv],
        _ownerInstanceId: 'g1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['g1'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
        rolls: {
          action: {
            gmDie: { value: 15 },
            hopeDie: null,
            fearDie: null,
            dice: [],
            statics: [],
            isSuccess: true,
            isCritical: false,
          },
          damage: {},
        },
      }
    );

    expect(chips).toHaveLength(0);
  });
});

describe('Vengeance — Act of Reprisal', () => {
  it('onReviewOutcome stores reprisal adversary when an ally in your Melee takes damage from an adversary', () => {
    const g = mockCharacter({ instanceId: 'g1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'ally-1', tokenX: 5, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 10, tokenY: 0 });

    const { mutations } = runReviewOutcome(
      { ...ActOfReprisal, _ownerInstanceId: 'g1' },
      {
        activeElements: [g, ally, adv],
        _ownerInstanceId: 'g1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['ally-1'],
          effects: [{ type: 'damage', target: ally, amount: 2, source: adv }],
        },
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Act of Reprisal',
          key: 'reprisalAdversaryId',
          value: 'adv-1',
        }),
      })
    );
  });

  it('does not set reprisal when the damaged ally is not in your Melee range', () => {
    const g = mockCharacter({ instanceId: 'g1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'ally-1', tokenX: 200, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 210, tokenY: 0 });

    const { mutations } = runReviewOutcome(
      { ...ActOfReprisal, _ownerInstanceId: 'g1' },
      {
        activeElements: [g, ally, adv],
        _ownerInstanceId: 'g1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['ally-1'],
          effects: [{ type: 'damage', target: ally, amount: 2, source: adv }],
        },
      }
    );

    const reprisal = mutations.filter(
      (m) => m.type === 'setFeatureState' && m.payload?.key === 'reprisalAdversaryId'
    );
    expect(reprisal).toHaveLength(0);
  });

  it('onIntent adds +1 static when attacking the reprisal adversary', () => {
    const g = mockCharacter({ instanceId: 'g1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const gs = mockGameState({
      activeElements: [g, adv],
      _ownerInstanceId: 'g1',
      _featureKey: 'Act of Reprisal',
      featureState: { 'Act of Reprisal': { reprisalAdversaryId: 'adv-1' } },
      action: {
        type: 'attack',
        actorInstanceId: 'g1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    });

    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'g1', targetInstanceIds: ['adv-1'] }),
      [{ ...ActOfReprisal, _ownerInstanceId: 'g1' }]
    );
    loop.setRolls(gs.rolls);
    const intent = loop.runPhase('intent');
    expect(intent.mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ name: 'Act of Reprisal', value: 1 }),
      })
    );
  });
});

describe('Vengeance — Nemesis', () => {
  it('exposes Prioritize (card) and Swap Hope and Fear (reviewAction) chips', () => {
    expect(Nemesis.name).toBe('Nemesis');
    expect(Array.isArray(Nemesis.chips)).toBe(true);
    expect(Nemesis.chips.length).toBe(2);
    expect(typeof Nemesis.hooks.onRest).toBe('function');
  });

  it('Prioritize card chip spends 2 Hope and stores selected adversary id', () => {
    const g = mockCharacter({ instanceId: 'g1', tokenX: 0, tokenY: 0, hope: 5 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const gs = mockGameState({
      activeElements: [g, adv],
      _ownerInstanceId: 'g1',
      _featureKey: 'Nemesis',
      featureState: {},
      action: {
        type: 'free',
        actorInstanceId: 'g1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });

    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Nemesis, _ownerInstanceId: 'g1' }], 'card', tbl);
    const pri = chips.filter((c) => c.name === 'Prioritize');
    expect(pri).toHaveLength(1);
    expect(pri[0].hopeCost).toBe(2);
    expect(pri[0].placements).toContain('card');

    const fromUse = activateChip(pri[0], tbl, makeChipState(), { selectedTargetIds: ['adv-1'] });
    deductChipCosts(pri[0], tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Nemesis',
          key: 'prioritizedAdversaryId',
          value: 'adv-1',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'g1', amount: 2 }),
      })
    );
  });

  it('Swap Hope and Fear chip calls swapHopeFear when attacking prioritized adversary', () => {
    const g = mockCharacter({ instanceId: 'g1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const gs = mockGameState({
      activeElements: [g, adv],
      _ownerInstanceId: 'g1',
      _featureKey: 'Nemesis',
      featureState: { Nemesis: { prioritizedAdversaryId: 'adv-1' } },
      action: {
        type: 'attack',
        actorInstanceId: 'g1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ hopeValue: 2, fearValue: 11 }),
    });

    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Nemesis, _ownerInstanceId: 'g1' }], 'reviewAction', tbl, {});
    const swap = chips.find((c) => c.name === 'Swap Hope and Fear');
    expect(swap).toBeDefined();

    const fromUse = activateChip(swap, tbl, makeChipState());
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'swapHopeFearDice', payload: { rollKey: 'action' } })
    );
    expect(tbl.rolls.action.hopeDie.value).toBe(11);
    expect(tbl.rolls.action.fearDie.value).toBe(2);
  });

  it('onRest clears prioritized adversary on short or long rest', () => {
    const g = mockCharacter({ instanceId: 'g1' });
    const gsShort = mockGameState({
      activeElements: [g],
      _ownerInstanceId: 'g1',
      _featureKey: 'Nemesis',
      featureState: { Nemesis: { prioritizedAdversaryId: 'adv-1' } },
      action: { type: 'shortRest', actorInstanceId: 'g1', targetInstanceIds: [], effects: [], appliedEffects: [] },
    });
    const tblS = buildTableSnapshot(gsShort);
    Nemesis.hooks.onRest(tblS);
    expect(applyMutations(tblS)).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'prioritizedAdversaryId', value: null }),
      })
    );

    const gsLong = mockGameState({
      activeElements: [g],
      _ownerInstanceId: 'g1',
      _featureKey: 'Nemesis',
      featureState: { Nemesis: { prioritizedAdversaryId: 'adv-1' } },
      action: { type: 'longRest', actorInstanceId: 'g1', targetInstanceIds: [], effects: [], appliedEffects: [] },
    });
    const tblL = buildTableSnapshot(gsLong);
    Nemesis.hooks.onRest(tblL);
    expect(applyMutations(tblL)).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'prioritizedAdversaryId', value: null }),
      })
    );
  });
});
