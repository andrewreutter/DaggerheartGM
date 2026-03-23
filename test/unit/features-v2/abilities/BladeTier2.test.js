import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import {
  dispatchStateChangeHooks,
  dispatchSceneEndHooks,
} from '../../../../src/features-v2/engine/action-loop.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { DeadlyFocus } from '../../../../src/features-v2/abilities/Blade/DeadlyFocus.js';
import { FortifiedArmor } from '../../../../src/features-v2/abilities/Blade/FortifiedArmor.js';
import { ChampionsEdge } from '../../../../src/features-v2/abilities/Blade/ChampionsEdge.js';
import { Vitality } from '../../../../src/features-v2/abilities/Blade/Vitality.js';
import { BattleHardened } from '../../../../src/features-v2/abilities/Blade/BattleHardened.js';
import { BladeTouched } from '../../../../src/features-v2/abilities/Blade/BladeTouched.js';
import {
  mockCharacter,
  mockGameState,
  mockAdversary,
  mockRoll,
  runReviewAction,
  runReviewOutcome,
  runIntent,
} from '../helpers.js';

const fourBlade = () => [1, 2, 3, 4].map((i) => ({ id: `blade-${i}`, domain: 'blade' }));

const deadlyFocusFeat = { ...DeadlyFocus, _ownerInstanceId: 'char-1' };

describe('Blade Tier 2 — Deadly Focus', () => {
  it('onIntent adds +1 static to attack and damage rolls against the focused adversary', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(deadlyFocusFeat, {
      activeElements: [char, adv],
      featureState: { 'Deadly Focus': { deadlyFocusTargetId: 'adv-1' } },
      rolls: mockRoll(),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Deadly Focus',
          value: 1,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Deadly Focus',
          value: 1,
        }),
      })
    );
  });

  it('onIntent clears focus when attacking a different creature', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv1 = mockAdversary({ instanceId: 'adv-1', name: 'A' });
    const adv2 = mockAdversary({ instanceId: 'adv-2', name: 'B' });
    const { mutations } = runIntent(deadlyFocusFeat, {
      activeElements: [char, adv1, adv2],
      featureState: { 'Deadly Focus': { deadlyFocusTargetId: 'adv-1' } },
      rolls: mockRoll(),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-2'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    expect(mutations.some((m) => m.type === 'addRollStatic')).toBe(false);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Deadly Focus',
          key: 'deadlyFocusTargetId',
          value: null,
        }),
      })
    );
  });

  it('onStateChange clears focus when the focused adversary is defeated', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1', currentHp: 0, maxHp: 3 });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Deadly Focus',
      featureState: { 'Deadly Focus': { deadlyFocusTargetId: 'adv-1' } },
      action: null,
      rolls: null,
    });
    const { mutations } = dispatchStateChangeHooks(
      gs,
      [deadlyFocusFeat],
      [{ type: 'markHP', payload: { instanceId: 'adv-1', amount: 1 } }]
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'deadlyFocusTargetId',
          value: null,
        }),
      })
    );
  });

  it('onSceneEnd clears active focus', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Deadly Focus',
      featureState: { 'Deadly Focus': { deadlyFocusTargetId: 'adv-1' } },
      action: null,
      rolls: null,
    });
    const { mutations } = dispatchSceneEndHooks(gs, [deadlyFocusFeat]);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'deadlyFocusTargetId',
          value: null,
        }),
      })
    );
  });
});

describe('Blade Tier 2 — Fortified Armor', () => {
  it('adds +2 Major and Severe thresholds when armorId is set', () => {
    const { stats } = applyDeclarativeFeatures(
      [{ ...FortifiedArmor, _ownerInstanceId: 'b1' }],
      mockCharacter({
        instanceId: 'b1',
        armorId: 'srd-armor-leather',
        armorThresholds: { major: 7, severe: 14 },
      }),
      {},
      null
    );
    expect(stats.majorThreshold).toBe(9);
    expect(stats.severeThreshold).toBe(16);
  });

  it('does not add thresholds when unarmored', () => {
    const { stats } = applyDeclarativeFeatures(
      [{ ...FortifiedArmor, _ownerInstanceId: 'b1' }],
      mockCharacter({
        instanceId: 'b1',
        armorId: null,
        armorThresholds: { major: 7, severe: 14 },
      }),
      {},
      null
    );
    expect(stats.majorThreshold).toBe(7);
    expect(stats.severeThreshold).toBe(14);
  });
});

describe('Blade Tier 2 — Battle-Hardened', () => {
  it('shows reviewOutcome chip when incoming HP loss would force a Death Move', () => {
    const char = mockCharacter({ instanceId: 'b1', currentHp: 2, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewOutcome(
      { ...BattleHardened, _ownerInstanceId: 'b1' },
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
    expect(chips[0].hopeCost).toBe(1);
    expect(chips[0].frequency).toBe('longRest');
  });

  it('does not show chip when damage would not reach Death Move', () => {
    const char = mockCharacter({ instanceId: 'b1', currentHp: 4, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewOutcome(
      { ...BattleHardened, _ownerInstanceId: 'b1' },
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

  it('hides chip when the long-rest frequency has been consumed', () => {
    const char = mockCharacter({ instanceId: 'b1', currentHp: 2, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewOutcome(
      { ...BattleHardened, _ownerInstanceId: 'b1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'b1',
        usageStore: {
          'Battle-Hardened::Battle-Hardened::reviewOutcome': { used: true, cycle: 'longRest', count: 1 },
        },
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['b1'],
          effects: [{ stat: 'currentHP', target: char, amount: 3, source: adv }],
        },
      }
    );
    expect(chips).toHaveLength(0);
  });

  it('onUse reduces lethal pending HP loss to leave 1 HP and spendHope applies', () => {
    const char = mockCharacter({ instanceId: 'b1', currentHp: 2, maxHp: 6, hope: 2 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ stat: 'currentHP', target: char, amount: 3, source: adv }];
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'b1',
      _featureKey: 'Battle-Hardened',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['b1'],
        effects,
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...BattleHardened, _ownerInstanceId: 'b1' }], 'reviewOutcome', tbl);
    expect(chips).toHaveLength(1);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(effects[0].amount).toBe(1);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'b1', amount: 1 }),
      })
    );
  });
});

describe("Blade Tier 2 — Champion's Edge", () => {
  it('shows reviewAction multi-select chip on a critical attack success', () => {
    const { chips } = runReviewAction(
      { ...ChampionsEdge, _ownerInstanceId: 'b1' },
      {
        activeElements: [mockCharacter({ instanceId: 'b1', hope: 3 }), mockAdversary({ instanceId: 'adv-1' })],
        _ownerInstanceId: 'b1',
        action: { type: 'attack', actorInstanceId: 'b1', targetInstanceIds: ['adv-1'] },
        rolls: mockRoll({ action: { isSuccess: true, isCritical: true } }),
      }
    );
    const ce = chips.filter((c) => c.name === "Champion's Edge");
    expect(ce).toHaveLength(1);
    expect(ce[0].multiSelect).toBe(true);
    expect(ce[0].placements).toContain('reviewAction');
  });

  it('does not show chip when the attack is not a critical', () => {
    const { chips } = runReviewAction(
      { ...ChampionsEdge, _ownerInstanceId: 'b1' },
      {
        activeElements: [mockCharacter({ instanceId: 'b1', hope: 3 }), mockAdversary()],
        _ownerInstanceId: 'b1',
        action: { type: 'attack', actorInstanceId: 'b1', targetInstanceIds: ['adv-1'] },
        rolls: mockRoll({ action: { isSuccess: true, isCritical: false } }),
      }
    );
    expect(chips.filter((c) => c.name === "Champion's Edge")).toHaveLength(0);
  });

  it('onUse spends Hope equal to selections and applies clear HP, clear Armor, and extra target HP', () => {
    const self = mockCharacter({
      instanceId: 'b1',
      hope: 3,
      currentHp: 2,
      maxHp: 6,
      currentArmor: 2,
      maxArmor: 3,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [self, adv],
      _ownerInstanceId: 'b1',
      _featureKey: "Champion's Edge",
      action: {
        type: 'attack',
        actorInstanceId: 'b1',
        targetInstanceIds: ['adv-1'],
        effects: [],
      },
      rolls: mockRoll({ action: { isSuccess: true, isCritical: true } }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ChampionsEdge, _ownerInstanceId: 'b1' }], 'reviewAction', tbl);
    const m = activateChip(chips[0], tbl, makeChipState(), {
      selectedIds: ['clearHp', 'clearArmor', 'extraTargetHp'],
    });
    const all = [...m, ...applyMutations(tbl)];
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'b1', amount: 3 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: expect.objectContaining({ instanceId: 'b1', amount: 1 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'clearArmor',
        payload: expect.objectContaining({ instanceId: 'b1', amount: 1 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'markHP',
        payload: expect.objectContaining({ instanceId: 'adv-1', amount: 1 }),
      })
    );
  });
});

describe('Blade Tier 2 — Blade-Touched', () => {
  it('adds +4 Severe threshold when 4+ Blade domain cards are in loadout', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      domainLoadout: fourBlade(),
      armorThresholds: { major: 7, severe: 14 },
    });
    const { stats } = applyDeclarativeFeatures([{ ...BladeTouched, _ownerInstanceId: 'c1' }], char, {});
    expect(stats.severeThreshold).toBe(18);
    expect(stats.majorThreshold).toBe(7);
  });

  it('does not add Severe threshold when fewer than 4 Blade domain cards', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      domainLoadout: [{ id: 'a', domain: 'blade' }, { id: 'b', domain: 'blade' }],
      armorThresholds: { major: 7, severe: 14 },
    });
    const { stats } = applyDeclarativeFeatures([{ ...BladeTouched, _ownerInstanceId: 'c1' }], char, {});
    expect(stats.severeThreshold).toBe(14);
  });

  it('onIntent adds +2 to action roll on attacks when Blade-Touched is active', () => {
    const char = mockCharacter({ instanceId: 'char-1', domainLoadout: fourBlade() });
    const { mutations } = runIntent(
      { ...BladeTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, mockAdversary()],
        actionType: 'attack',
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Blade-Touched',
          value: 2,
        }),
      })
    );
  });

  it('does not add attack bonus on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'char-1', domainLoadout: fourBlade() });
    const { mutations } = runIntent(
      { ...BladeTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, mockAdversary()],
        actionType: 'action',
      }
    );
    expect(mutations.some((m) => m.type === 'addRollStatic')).toBe(false);
  });
});

describe('Blade Tier 2 — Vitality', () => {
  it('applies passive mods from persisted picks (stress + thresholds)', () => {
    const { stats } = applyDeclarativeFeatures(
      [{ ...Vitality, _ownerInstanceId: 'b1' }],
      mockCharacter({
        instanceId: 'b1',
        featureState: { Vitality: { picks: ['stress', 'thresholds'] } },
        maxHp: 6,
        maxStress: 6,
        armorThresholds: { major: 7, severe: 14 },
      }),
      {},
      null
    );
    expect(stats.maxHP).toBe(6);
    expect(stats.maxStress).toBe(7);
    expect(stats.majorThreshold).toBe(9);
    expect(stats.severeThreshold).toBe(16);
  });

  it('applies +1 maxHP when hp is chosen with stress', () => {
    const { stats } = applyDeclarativeFeatures(
      [{ ...Vitality, _ownerInstanceId: 'b1' }],
      mockCharacter({
        instanceId: 'b1',
        featureState: { Vitality: { picks: ['hp', 'stress'] } },
        maxHp: 5,
        maxStress: 4,
        armorThresholds: { major: 8, severe: 16 },
      }),
      {},
      null
    );
    expect(stats.maxHP).toBe(6);
    expect(stats.maxStress).toBe(5);
    expect(stats.majorThreshold).toBe(8);
    expect(stats.severeThreshold).toBe(16);
  });

  it('card chip records picks and queues setFeatureState + actionLoop', () => {
    const char = mockCharacter({ instanceId: 'b1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        adversary: undefined,
        _ownerInstanceId: 'b1',
        _featureKey: 'Vitality',
        featureState: {},
      })
    );
    const chips = collectChips([{ ...Vitality, _ownerInstanceId: 'b1' }], 'card', tbl);
    const multi = chips.find((c) => c.multiSelect === true);
    expect(multi?.name).toBe('Choose two permanent benefits');
    const m = activateChip(multi, tbl, makeChipState(), { selectedIds: ['stress', 'hp'] });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Vitality',
          key: 'picks',
          value: ['hp', 'stress'],
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'b1',
          title: 'Vitality',
        }),
      })
    );
  });

  it('disables the choice chip after two picks are stored', () => {
    const char = mockCharacter({
      instanceId: 'b1',
      featureState: { Vitality: { picks: ['hp', 'stress'] } },
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        adversary: undefined,
        _ownerInstanceId: 'b1',
        _featureKey: 'Vitality',
        featureState: { Vitality: { picks: ['hp', 'stress'] } },
      })
    );
    const chips = collectChips([{ ...Vitality, _ownerInstanceId: 'b1' }], 'card', tbl);
    const multi = chips.find((c) => c.multiSelect === true);
    expect(multi.disabled).toBe(true);
  });
});
