import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  makeChipState,
  deductChipCosts,
} from '../../../../src/features-v2/engine/chip-system.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { DeathGrip } from '../../../../src/features-v2/abilities/Sage/DeathGrip.js';
import { Forager } from '../../../../src/features-v2/abilities/Sage/Forager.js';
import { ForestSprites } from '../../../../src/features-v2/abilities/Sage/ForestSprites.js';
import { RejuvenationBarrier } from '../../../../src/features-v2/abilities/Sage/RejuvenationBarrier.js';
import { HealingField } from '../../../../src/features-v2/abilities/Sage/HealingField.js';
import { PlantDominion } from '../../../../src/features-v2/abilities/Sage/PlantDominion.js';
import { ConjuredSteeds } from '../../../../src/features-v2/abilities/Sage/ConjuredSteeds.js';
import { SageTouched } from '../../../../src/features-v2/abilities/Sage/SageTouched.js';
import { ThornSkin } from '../../../../src/features-v2/abilities/Sage/ThornSkin.js';
import {
  mockGameState,
  mockCharacter,
  mockAdversary,
  mockRoll,
  mockAdversaryAttackRoll,
  mockAction,
  runIntent,
  runReviewAction,
} from '../helpers.js';
import { buildTableSnapshot, applyMutations as applyTableMutations } from '../../../../src/features-v2/engine/table.js';

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

const fourSage = () => [1, 2, 3, 4].map((i) => ({ id: `sage-${i}`, domain: 'sage' }));

describe('Sage Tier 2 — Sage-Touched', () => {
  it('adds +2 to spellcast trait when 4+ Sage cards, natural environment on', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      spellcastTrait: 'instinct',
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 2, presence: 0, knowledge: 0 },
      domainLoadout: fourSage(),
    });
    const { stats } = applyDeclarativeFeatures(
      [{ ...SageTouched, _ownerInstanceId: 'c1' }],
      char,
      { featureState: { 'Sage-Touched': { naturalEnvironment: true } } }
    );
    expect(stats.instinct).toBe(4);
    expect(stats.agility).toBe(0);
  });

  it('does not add spellcast bonus without natural environment toggle', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      spellcastTrait: 'instinct',
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 2, presence: 0, knowledge: 0 },
      domainLoadout: fourSage(),
    });
    const { stats } = applyDeclarativeFeatures([{ ...SageTouched, _ownerInstanceId: 'c1' }], char, {});
    expect(stats.instinct).toBe(2);
  });

  it('does not add spellcast bonus when fewer than 4 Sage domain cards', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      spellcastTrait: 'instinct',
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 2, presence: 0, knowledge: 0 },
      domainLoadout: [{ id: 'a', domain: 'sage' }],
    });
    const { stats } = applyDeclarativeFeatures(
      [{ ...SageTouched, _ownerInstanceId: 'c1' }],
      char,
      { featureState: { 'Sage-Touched': { naturalEnvironment: true } } }
    );
    expect(stats.instinct).toBe(2);
  });

  it('intent chip adds trait score again on Agility roll when Sage-Touched is active', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: fourSage(),
      traits: { agility: 3, strength: 0, finesse: 0, instinct: 1, presence: 0, knowledge: 0 },
    });
    const { chips } = runIntent(
      { ...SageTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, mockAdversary()],
        action: { trait: 'Agility' },
      }
    );
    const dbl = chips.find((c) => c.name === 'Sage-Touched — Double trait');
    expect(dbl).toBeDefined();

    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, mockAdversary()],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Sage-Touched',
        rolls: mockRoll(),
      })
    );
    const m = activateChip(dbl, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ name: 'Sage-Touched (double trait)', value: 3 }),
      })
    );
  });

  it('does not offer double-trait intent chip when fewer than 4 Sage cards', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: [{ id: 'x', domain: 'sage' }],
      traits: { agility: 3, strength: 0, finesse: 0, instinct: 1, presence: 0, knowledge: 0 },
    });
    const { chips } = runIntent(
      { ...SageTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, mockAdversary()],
        action: { trait: 'Agility' },
      }
    );
    expect(chips.filter((c) => c.name === 'Sage-Touched — Double trait')).toHaveLength(0);
  });
});

describe('Sage Tier 2 — Forager', () => {
  it('applyDeclarativeFeatures adds one short-rest and one long-rest downtime slot', () => {
    const char = mockCharacter({ instanceId: 'fg1' });
    const { stats } = applyDeclarativeFeatures([{ ...Forager, _ownerInstanceId: 'fg1' }], char, {});
    expect(stats.numShortRestSlots).toBe(1);
    expect(stats.numLongRestSlots).toBe(1);
  });

  it('card queues actionLoop; deductChipCosts spends 1 Hope (recall)', () => {
    const tbl = freeActionTable('fg1', 'Forager');
    const chips = collectChips([{ ...Forager, _ownerInstanceId: 'fg1' }], 'card', tbl);
    const card = chips.find((c) => c.name === 'Forager');
    const fromUse = activateChip(card, tbl, makeChipState());
    deductChipCosts(card, tbl);
    const m = [...fromUse, ...applyTableMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Forager' }),
      })
    );
    expect(m).toContainEqual(expect.objectContaining({ type: 'spendHope', payload: expect.objectContaining({ amount: 1 }) }));
  });
});

describe('Sage Tier 2 — Thorn Skin', () => {
  it('Sprout thorns places tokens equal to Spellcast trait and queues actionLoop', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [
          mockCharacter({
            instanceId: 'ts1',
            spellcastTrait: 'presence',
            traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 3, knowledge: 0 },
          }),
        ],
        _ownerInstanceId: 'ts1',
        _featureKey: 'Thorn Skin',
        featureState: { 'Thorn Skin': {} },
        action: {
          type: 'free',
          actorInstanceId: 'ts1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...ThornSkin, _ownerInstanceId: 'ts1' }], 'card', tbl);
    const sprout = chips.find((c) => c.name === 'Sprout thorns');
    const m = [...activateChip(sprout, tbl, makeChipState()), ...applyTableMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ featureKey: 'Thorn Skin', key: 'thornSkinTokens', value: 3 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Thorn Skin' }),
      })
    );
  });

  it('onRest clears unspent thorn tokens', () => {
    const char = mockCharacter({ instanceId: 'ts2' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'ts2',
        _featureKey: 'Thorn Skin',
        featureState: { 'Thorn Skin': { thornSkinTokens: 4 } },
        action: {
          type: 'shortRest',
          actorInstanceId: 'ts2',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    ThornSkin.hooks.onRest(tbl);
    const m = applyTableMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ featureKey: 'Thorn Skin', key: 'thornSkinTokens', value: 0 }),
      })
    );
  });

  it('reviewAction spend reduces pending damage by rolled d6 total and spends tokens', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      spellcastTrait: 'presence',
      traits: { presence: 2, agility: 1, strength: 1, finesse: 0, instinct: 0, knowledge: 0 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      {
        type: 'damage',
        target: char,
        amount: 12,
        source: adv,
        damageType: 'physical',
      },
    ];
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Thorn Skin',
        featureState: { 'Thorn Skin': { thornSkinTokens: 2 } },
        _rng: () => 0.99,
        action: {
          type: 'attack',
          actorInstanceId: adv.instanceId,
          targetInstanceIds: [char.instanceId],
          effects,
          appliedEffects: [],
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      })
    );
    const chips = collectChips([{ ...ThornSkin, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const thorn = chips.find((c) => c.name === 'Thorn Skin');
    expect(thorn).toBeDefined();
    const m = [...activateChip(thorn, tbl, makeChipState(), { selectedId: '2' }), ...applyTableMutations(tbl)];
    expect(effects[0].amount).toBe(0);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ featureKey: 'Thorn Skin', key: 'thornSkinTokens', value: 0 }),
      })
    );
  });

  it('in Melee with attacker, retaliation marks HP on attacker', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      tokenX: 0,
      tokenY: 0,
      spellcastTrait: 'presence',
      traits: { presence: 1, agility: 1, strength: 1, finesse: 0, instinct: 0, knowledge: 0 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 0, tokenY: 0, currentHp: 5, maxHp: 5 });
    const effects = [
      {
        type: 'damage',
        target: char,
        amount: 8,
        source: adv,
        damageType: 'physical',
      },
    ];
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Thorn Skin',
        featureState: { 'Thorn Skin': { thornSkinTokens: 1 } },
        _rng: () => 0.99,
        action: {
          type: 'attack',
          actorInstanceId: adv.instanceId,
          targetInstanceIds: [char.instanceId],
          effects,
          appliedEffects: [],
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      })
    );
    const chips = collectChips([{ ...ThornSkin, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const thorn = chips.find((c) => c.name === 'Thorn Skin');
    const m = [...activateChip(thorn, tbl, makeChipState(), { selectedId: '1' }), ...applyTableMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markHP',
        payload: expect.objectContaining({ instanceId: 'adv-1', amount: 6 }),
      })
    );
  });
});

describe('Sage Tier 2 — Conjured Steeds', () => {
  it('onIntent applies −2 to attack rolls while steeds are active', () => {
    const char = mockCharacter({ instanceId: 'cs1', hope: 4 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(
      { ...ConjuredSteeds, _ownerInstanceId: 'cs1' },
      {
        activeElements: [char, adv],
        _featureKey: 'Conjured Steeds',
        featureState: { 'Conjured Steeds': { conjuredSteedsActive: true } },
        action: mockAction({ type: 'attack', actorInstanceId: 'cs1' }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Conjured Steeds (riding)',
          value: -2,
        }),
      })
    );
  });

  it('onReviewAction applies +2 to damage on a successful attack while riding', () => {
    const char = mockCharacter({ instanceId: 'cs1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewAction(
      { ...ConjuredSteeds, _ownerInstanceId: 'cs1' },
      {
        activeElements: [char, adv],
        _featureKey: 'Conjured Steeds',
        featureState: { 'Conjured Steeds': { conjuredSteedsActive: true } },
        action: mockAction({ type: 'attack', actorInstanceId: 'cs1' }),
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Conjured Steeds (riding)',
          value: 2,
        }),
      })
    );
  });

  it('Conjure steeds chip spends selected Hope and sets active state', () => {
    const tbl = freeActionTable('cs1', 'Conjured Steeds');
    const chips = collectChips([{ ...ConjuredSteeds, _ownerInstanceId: 'cs1' }], 'card', tbl);
    const card = chips.find((c) => c.name === 'Conjure steeds');
    const fromUse = activateChip(card, tbl, makeChipState(), { selectedId: '2' });
    deductChipCosts(card, tbl);
    const m = [...fromUse, ...applyTableMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Conjured Steeds',
          key: 'conjuredSteedsActive',
          value: true,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'cs1', amount: 2 }),
      })
    );
  });
});

describe('Sage Tier 2 — Death Grip', () => {
  it('card queues Spellcast actionLoop with trait', () => {
    const tbl = freeActionTable('dg1', 'Death Grip');
    const chips = collectChips([{ ...DeathGrip, _ownerInstanceId: 'dg1' }], 'card', tbl);
    const main = chips.find((c) => c.name === 'Death Grip');
    const m = activateChip(main, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Death Grip', trait: 'Presence' }),
      })
    );
  });
});

describe('Sage Tier 2 — Forest Sprites', () => {
  it('card has recall Hope cost 2 and queues Spellcast (13) actionLoop with trait', () => {
    const tbl = freeActionTable('fs1', 'Forest Sprites');
    const chips = collectChips([{ ...ForestSprites, _ownerInstanceId: 'fs1' }], 'card', tbl);
    const main = chips[0];
    expect(main?.hopeCost).toBe(2);
    const m = activateChip(main, tbl, makeChipState());
    deductChipCosts(main, tbl);
    const fromCost = applyTableMutations(tbl);
    expect([...m, ...fromCost]).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'fs1', amount: 2 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Forest Sprites',
          trait: 'Presence',
          difficulty: 13,
        }),
      })
    );
  });
});

describe('Sage Tier 2 — Rejuvenation Barrier', () => {
  const rb = { ...RejuvenationBarrier, _ownerInstanceId: 'rb1' };

  it('card is once per rest, recall 1 Hope, and queues Spellcast (15)', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'rb1', spellcastTrait: 'presence' })],
        _ownerInstanceId: 'rb1',
        _featureKey: 'Rejuvenation Barrier',
        featureState: { 'Rejuvenation Barrier': {} },
        action: {
          type: 'free',
          actorInstanceId: 'rb1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([rb], 'card', tbl);
    const main = chips[0];
    expect(main?.frequency).toBe('rest');
    expect(main?.hopeCost).toBe(1);
    const m = [...activateChip(main, tbl, makeChipState()), ...applyTableMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'rbAwaitingSpellcast', value: true }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Rejuvenation Barrier',
          difficulty: 15,
        }),
      })
    );
  });

  it('onReviewAction after successful Spellcast heals Very Close allies and activates barrier', () => {
    const caster = mockCharacter({
      instanceId: 'rb1',
      tokenX: 0,
      tokenY: 0,
      spellcastTrait: 'presence',
    });
    const ally = mockCharacter({ instanceId: 'rb2', name: 'Ally', tokenX: 8, tokenY: 0 });
    const far = mockCharacter({ instanceId: 'rb3', tokenX: 50, tokenY: 0 });
    const { mutations } = runReviewAction(rb, {
      featureState: { 'Rejuvenation Barrier': { rbAwaitingSpellcast: true } },
      actionType: 'spellcast',
      action: mockAction({ type: 'spellcast', actorInstanceId: 'rb1', targetInstanceIds: [] }),
      rolls: mockRoll({ isSuccess: true }),
      activeElements: [caster, ally, far],
      _rng: () => 0.01,
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'rejuvenationBarrierActive', value: true }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'clearHP', payload: { instanceId: 'rb1', amount: 1 } })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'clearHP', payload: { instanceId: 'rb2', amount: 1 } })
    );
    expect(mutations.filter((m) => m.type === 'clearHP' && m.payload?.instanceId === 'rb3')).toHaveLength(0);
  });

  it('onReviewAction halves physical damage from outside the barrier for targets inside', () => {
    const caster = mockCharacter({ instanceId: 'rb1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'rb2', tokenX: 5, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 40, tokenY: 0 });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'rb2', elementType: 'character', name: 'Ally' },
        amount: 7,
        damageType: 'physical',
        source: adv,
      },
    ];
    const { loop } = runReviewAction(rb, {
      featureState: { 'Rejuvenation Barrier': { rejuvenationBarrierActive: true } },
      actionType: 'attack',
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'adv-1', targetInstanceIds: ['rb2'] }),
        effects,
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      activeElements: [caster, ally, adv],
    });
    const dmg = loop.gameState.action.effects.find((e) => e.type === 'damage');
    expect(dmg?.amount).toBe(4);
  });

  it('onRest clears barrier on long rest', () => {
    const char = mockCharacter({ instanceId: 'rb1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'rb1',
        _featureKey: 'Rejuvenation Barrier',
        featureState: { 'Rejuvenation Barrier': { rejuvenationBarrierActive: true } },
        action: {
          type: 'longRest',
          actorInstanceId: 'rb1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    RejuvenationBarrier.hooks.onRest(tbl);
    const m = applyTableMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'rejuvenationBarrierActive', value: false }),
      })
    );
  });
});

describe('Sage Tier 2 — Healing Field', () => {
  function tableWithParty() {
    return buildTableSnapshot(
      mockGameState({
        activeElements: [
          mockCharacter({ instanceId: 'hf1', tokenX: 0, tokenY: 0, currentHp: 4, maxHp: 6 }),
          mockCharacter({ instanceId: 'hf2', tokenX: 10, tokenY: 0, currentHp: 3, maxHp: 6 }),
          mockCharacter({ instanceId: 'hf3', tokenX: 40, tokenY: 0, currentHp: 2, maxHp: 6 }),
        ],
        _ownerInstanceId: 'hf1',
        _featureKey: 'Healing Field',
        featureState: { 'Healing Field': {} },
        action: {
          type: 'free',
          actorInstanceId: 'hf1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
  }

  it('standard mode clears 1 HP on caster and allies within Close, not out-of-range ally', () => {
    const tbl = tableWithParty();
    const chips = collectChips([{ ...HealingField, _ownerInstanceId: 'hf1' }], 'card', tbl);
    const card = chips.find((c) => c.name === 'Healing Field');
    const fromUse = activateChip(card, tbl, makeChipState(), { selectedId: 'standard' });
    deductChipCosts(card, tbl);
    const m = [...fromUse, ...applyTableMutations(tbl)];
    const hope = m.filter((x) => x.type === 'spendHope');
    expect(hope.reduce((s, x) => s + (x.payload?.amount ?? 0), 0)).toBe(2);
    expect(m).toContainEqual(
      expect.objectContaining({ type: 'clearHP', payload: { instanceId: 'hf1', amount: 1 } })
    );
    expect(m).toContainEqual(
      expect.objectContaining({ type: 'clearHP', payload: { instanceId: 'hf2', amount: 1 } })
    );
    expect(m.filter((x) => x.type === 'clearHP' && x.payload?.instanceId === 'hf3')).toHaveLength(0);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Healing Field' }),
      })
    );
  });

  it('empowered mode spends 4 Hope (recall + empower) and clears 2 HP on in-range allies', () => {
    const tbl = tableWithParty();
    const chips = collectChips([{ ...HealingField, _ownerInstanceId: 'hf1' }], 'card', tbl);
    const card = chips.find((c) => c.name === 'Healing Field');
    const fromUse = activateChip(card, tbl, makeChipState(), { selectedId: 'empowered' });
    deductChipCosts(card, tbl);
    const m = [...fromUse, ...applyTableMutations(tbl)];
    const hope = m.filter((x) => x.type === 'spendHope');
    expect(hope.reduce((s, x) => s + (x.payload?.amount ?? 0), 0)).toBe(4);
    expect(m).toContainEqual(
      expect.objectContaining({ type: 'clearHP', payload: { instanceId: 'hf1', amount: 2 } })
    );
    expect(m).toContainEqual(
      expect.objectContaining({ type: 'clearHP', payload: { instanceId: 'hf2', amount: 2 } })
    );
  });
});

describe('Sage Tier 2 — Plant Dominion', () => {
  it('card chip has 1 Hope recall and long-rest frequency', () => {
    const char = mockCharacter({
      instanceId: 'pd1',
      spellcastTrait: 'instinct',
      traits: { instinct: 2 },
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'pd1',
        _featureKey: 'Plant Dominion',
        action: {
          type: 'free',
          actorInstanceId: 'pd1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...PlantDominion, _ownerInstanceId: 'pd1' }], 'card', tbl);
    const card = chips.find((c) => c.name === 'Plant Dominion');
    expect(card?.hopeCost).toBe(1);
    expect(card?.frequency).toBe('longRest');
  });

  it('queues Spellcast (18) actionLoop and spendHope 1 on use', () => {
    const char = mockCharacter({ instanceId: 'pd1', spellcastTrait: 'presence' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'pd1',
        _featureKey: 'Plant Dominion',
      })
    );
    const chips = collectChips([{ ...PlantDominion, _ownerInstanceId: 'pd1' }], 'card', tbl);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const m = [...fromUse, ...applyTableMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Plant Dominion',
          trait: 'Presence',
          difficulty: 18,
          description: expect.stringContaining('within Far range'),
        }),
      })
    );
    expect(m).toContainEqual(expect.objectContaining({ type: 'spendHope', payload: expect.objectContaining({ amount: 1 }) }));
  });

  it('does not register intent-placement chips', () => {
    const char = mockCharacter({ instanceId: 'pd1' });
    const tbl = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'pd1' }));
    const intent = collectChips([{ ...PlantDominion, _ownerInstanceId: 'pd1' }], 'intent', tbl);
    expect(intent).toEqual([]);
  });
});
