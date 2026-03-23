import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';
import { Divination } from '../../../../src/features-v2/abilities/Splendor/Divination.js';
import { ShapeMaterial } from '../../../../src/features-v2/abilities/Splendor/ShapeMaterial.js';
import { Restoration } from '../../../../src/features-v2/abilities/Splendor/Restoration.js';
import { Smite } from '../../../../src/features-v2/abilities/Splendor/Smite.js';
import { StunningSunlight } from '../../../../src/features-v2/abilities/Splendor/StunningSunlight.js';
import { ZoneOfProtection } from '../../../../src/features-v2/abilities/Splendor/ZoneOfProtection.js';
import { OverwhelmingAura } from '../../../../src/features-v2/abilities/Splendor/OverwhelmingAura.js';
import { SalvationBeam } from '../../../../src/features-v2/abilities/Splendor/SalvationBeam.js';
import { LifeWard } from '../../../../src/features-v2/abilities/Splendor/LifeWard.js';
import { SplendorTouched } from '../../../../src/features-v2/abilities/Splendor/SplendorTouched.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockAction,
  mockRoll,
  mockAdversaryAttackRoll,
  runReviewAction,
  runReviewOutcome,
} from '../helpers.js';

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

describe('Splendor Tier 2 — Divination', () => {
  it('card costs 3 Hope, once per long rest, queues narrative actionLoop', () => {
    const tbl = freeActionTable('d1', 'Divination');
    const chips = collectChips([{ ...Divination, _ownerInstanceId: 'd1' }], 'card', tbl);
    const main = chips[0];
    expect(main?.hopeCost).toBe(3);
    expect(main?.frequency).toBe('longRest');
    const m = activateChip(main, tbl, makeChipState());
    deductChipCosts(main, tbl);
    const fromCost = applyMutations(tbl);
    expect([...m, ...fromCost]).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'd1', amount: 3 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Divination' }),
      })
    );
  });
});

describe('Splendor Tier 2 — Shape Material', () => {
  it('card costs 1 Hope, no usage frequency, queues narrative actionLoop', () => {
    const tbl = freeActionTable('s1', 'Shape Material');
    const chips = collectChips([{ ...ShapeMaterial, _ownerInstanceId: 's1' }], 'card', tbl);
    const main = chips[0];
    expect(main?.hopeCost).toBe(1);
    expect(main?.frequency).toBeUndefined();
    const m = activateChip(main, tbl, makeChipState());
    deductChipCosts(main, tbl);
    const fromCost = applyMutations(tbl);
    expect([...m, ...fromCost]).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 's1', amount: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Shape Material' }),
      })
    );
  });
});

describe('Splendor Tier 2 — Smite', () => {
  it('card costs 3 Hope, once per rest, sets smiteCharged', () => {
    const tbl = freeActionTable('sm1', 'Smite');
    const chips = collectChips([{ ...Smite, _ownerInstanceId: 'sm1' }], 'card', tbl);
    const main = chips[0];
    expect(main?.hopeCost).toBe(3);
    expect(main?.frequency).toBe('rest');
    const m = activateChip(main, tbl, makeChipState());
    deductChipCosts(main, tbl);
    const fromCost = applyMutations(tbl);
    expect([...m, ...fromCost]).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'sm1', amount: 3 }),
      })
    );
    expect([...m, ...fromCost]).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ featureKey: 'Smite', key: 'smiteCharged', value: true }),
      })
    );
  });

  it('onReviewAction doubles damage, sets magic type, clears charge on a charged successful weapon attack', () => {
    const { mutations, loop } = runReviewAction(Smite, {
      featureState: { Smite: { smiteCharged: true } },
      action: {
        ...mockAction({ type: 'attack', weaponId: 'w1' }),
        effects: [
          {
            type: 'damage',
            target: { instanceId: 'adv-1', elementType: 'adversary', name: 'A' },
            amount: 4,
            damageType: 'physical',
          },
        ],
      },
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 4 }],
        damageStatics: [],
      }),
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Smite', value: 4 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'smiteCharged', value: false }),
      })
    );
    const dmgEff = loop.gameState.action.effects.find((e) => e.type === 'damage');
    expect(dmgEff?.damageType).toBe('magic');
  });

  it('onReviewAction does nothing when smite is not charged', () => {
    const { mutations } = runReviewAction(Smite, {
      featureState: { Smite: {} },
      action: mockAction({ type: 'attack', weaponId: 'w1' }),
      rolls: mockRoll({ isSuccess: true, damageDice: [{ name: 'weapon', die: 'd8', value: 3 }] }),
    });
    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });

  it('onReviewAction does nothing without a weapon attack', () => {
    const { mutations } = runReviewAction(Smite, {
      featureState: { Smite: { smiteCharged: true } },
      action: mockAction({ type: 'attack', weaponId: null }),
      rolls: mockRoll({ isSuccess: true, damageDice: [{ name: 'weapon', die: 'd8', value: 3 }] }),
    });
    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });
});

describe('Splendor Tier 2 — Stunning Sunlight', () => {
  it('card spends 2 Hope (recall) and queues Spellcast actionLoop', () => {
    const tbl = freeActionTable('ss1', 'Stunning Sunlight');
    const chips = collectChips([{ ...StunningSunlight, _ownerInstanceId: 'ss1' }], 'card', tbl);
    const main = chips[0];
    expect(main?.hopeCost).toBe(2);
    expect(main?.frequency).toBeUndefined();
    const m = activateChip(main, tbl, makeChipState());
    deductChipCosts(main, tbl);
    const fromCost = applyMutations(tbl);
    expect([...m, ...fromCost]).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'ss1', amount: 2 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Stunning Sunlight' }),
      })
    );
  });
});

describe('Splendor Tier 2 — Zone of Protection', () => {
  const zop = { ...ZoneOfProtection, _ownerInstanceId: 'z1' };

  it('card is once per long rest and queues Spellcast (16) actionLoop', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'z1', spellcastTrait: 'presence' })],
        _ownerInstanceId: 'z1',
        _featureKey: 'Zone of Protection',
        featureState: { 'Zone of Protection': {} },
        action: { type: 'free', actorInstanceId: 'z1', targetInstanceIds: [], effects: [], appliedEffects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([zop], 'card', tbl);
    const main = chips[0];
    expect(main?.frequency).toBe('longRest');
    const m = activateChip(main, tbl, makeChipState());
    deductChipCosts(main, tbl);
    const fromCost = applyMutations(tbl);
    expect([...m, ...fromCost]).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Zone of Protection',
          difficulty: 16,
        }),
      })
    );
    expect([...m, ...fromCost]).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'zopAwaitingSpellcast', value: true }),
      })
    );
  });

  it('onReviewAction after a successful Spellcast sets d6 to 1 and stores zone center from token', () => {
    const { mutations } = runReviewAction(zop, {
      featureState: { 'Zone of Protection': { zopAwaitingSpellcast: true } },
      actionType: 'spellcast',
      action: mockAction({ type: 'spellcast', actorInstanceId: 'z1', targetInstanceIds: [] }),
      rolls: mockRoll({ isSuccess: true }),
      activeElements: [mockCharacter({ instanceId: 'z1', tokenX: 12, tokenY: 5 })],
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'zoneDieValue', value: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'zoneCenterX', value: 12 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'zoneCenterY', value: 5 }),
      })
    );
  });

  it('onReviewOutcome reduces damage for an ally in the zone and increments the d6', () => {
    const seraph = mockCharacter({ instanceId: 'z1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'a1', name: 'Ally', tokenX: 8, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations, loop } = runReviewOutcome(zop, {
      featureState: {
        'Zone of Protection': { zoneDieValue: 3, zoneCenterX: 0, zoneCenterY: 0 },
      },
      activeElements: [seraph, ally, adv],
      actionType: 'attack',
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'adv-1', targetInstanceIds: ['a1'] }),
        effects: [
          {
            type: 'damage',
            target: { instanceId: 'a1', elementType: 'character', name: 'Ally' },
            amount: 5,
            damageType: 'physical',
          },
        ],
      },
    });

    const dmg = loop.gameState.action.effects.find((e) => e.type === 'damage');
    expect(dmg?.amount).toBe(2);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'zoneDieValue', value: 4 }),
      })
    );
    expect(mutations.some((m) => m.type === 'addNarration')).toBe(true);
  });

  it('onReviewOutcome clears the zone when the d6 would exceed 6', () => {
    const seraph = mockCharacter({ instanceId: 'z1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'a1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations, loop } = runReviewOutcome(zop, {
      featureState: {
        'Zone of Protection': { zoneDieValue: 6, zoneCenterX: 0, zoneCenterY: 0 },
      },
      activeElements: [seraph, ally, adv],
      actionType: 'attack',
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'adv-1', targetInstanceIds: ['a1'] }),
        effects: [
          {
            type: 'damage',
            target: { instanceId: 'a1', elementType: 'character', name: 'Ally' },
            amount: 5,
            damageType: 'physical',
          },
        ],
      },
    });

    const dmg = loop.gameState.action.effects.find((e) => e.type === 'damage');
    expect(dmg?.amount).toBe(0);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'zoneDieValue', value: null }),
      })
    );
  });
});

const fourSplendor = () => [1, 2, 3, 4].map((i) => ({ id: `sp-${i}`, domain: 'splendor' }));

describe('Splendor Tier 2 — Splendor-Touched', () => {
  it('adds +3 to severe threshold when 4+ Splendor domain cards', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      domainLoadout: fourSplendor(),
      armorThresholds: { major: 7, severe: 12 },
    });
    const { stats } = applyDeclarativeFeatures([{ ...SplendorTouched, _ownerInstanceId: 'c1' }], char, {});
    expect(stats.severeThreshold).toBe(15);
  });

  it('does not add severe threshold bonus with fewer than 4 Splendor cards', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      domainLoadout: [{ id: 'a', domain: 'splendor' }],
      armorThresholds: { major: 7, severe: 12 },
    });
    const { stats } = applyDeclarativeFeatures([{ ...SplendorTouched, _ownerInstanceId: 'c1' }], char, {});
    expect(stats.severeThreshold).toBe(12);
  });

  it('reviewOutcome: Stress instead of HP when 4+ Splendor cards and targeted', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: fourSplendor(),
      currentStress: 0,
      maxStress: 6,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Splendor-Touched',
      currentActorInstanceId: 'adv-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [{ stat: 'currentHP', target: char, amount: 2 }],
        appliedEffects: [],
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...SplendorTouched, _ownerInstanceId: 'char-1' }], 'reviewOutcome', tbl);
    const mit = chips.find((c) => c.name === 'Splendor-Touched — Mitigate incoming HP');
    expect(mit).toBeDefined();
    const m = [...activateChip(mit, tbl, makeChipState(), { selectedId: 'stress' }), ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'splendorTouchedMitigateUsed', value: true }),
      })
    );
    expect(gs.action.effects.find((e) => e.stat === 'currentHP' && e.target === char)?.amount ?? 0).toBe(0);
    expect(gs.action.effects.find((e) => e.stat === 'currentStress' && e.target === char)?.amount).toBe(2);
  });

  it('reviewOutcome: Spend Hope instead of HP', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: fourSplendor(),
      hope: 5,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Splendor-Touched',
      currentActorInstanceId: 'adv-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [{ stat: 'currentHP', target: char, amount: 2 }],
        appliedEffects: [],
      },
      rolls: mockAdversaryAttackRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...SplendorTouched, _ownerInstanceId: 'char-1' }], 'reviewOutcome', tbl);
    const mit = chips.find((c) => c.name === 'Splendor-Touched — Mitigate incoming HP');
    const m = [...activateChip(mit, tbl, makeChipState(), { selectedId: 'hope' }), ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 2 }),
      })
    );
    expect(gs.action.effects.find((e) => e.stat === 'currentHP' && e.target === char)?.amount ?? 0).toBe(0);
  });

  it('does not offer mitigation chip without 4+ Splendor cards', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: [{ id: 'x', domain: 'splendor' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [{ stat: 'currentHP', target: char, amount: 2 }],
          appliedEffects: [],
        },
        rolls: mockAdversaryAttackRoll(),
      })
    );
    const chips = collectChips([{ ...SplendorTouched, _ownerInstanceId: 'char-1' }], 'reviewOutcome', tbl);
    expect(chips.filter((c) => c.name?.startsWith('Splendor-Touched'))).toHaveLength(0);
  });

  it('onRest (long rest) clears mitigation-used flag', () => {
    const char = mockCharacter({ instanceId: 'r1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'r1',
      _featureKey: 'Splendor-Touched',
      featureState: { 'Splendor-Touched': { splendorTouchedMitigateUsed: true } },
      action: {
        type: 'longRest',
        actorInstanceId: 'r1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    SplendorTouched.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Splendor-Touched',
          key: 'splendorTouchedMitigateUsed',
          value: false,
        }),
      })
    );
  });
});

describe('Splendor Tier 2 — Restoration', () => {
  it('onRest (long rest) sets tokens to Spellcast trait score via setFeatureState', () => {
    const char = mockCharacter({
      instanceId: 'r1',
      spellcastTrait: 'presence',
      traits: { presence: 3 },
    });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'r1',
      _featureKey: 'Restoration',
      featureState: { Restoration: {} },
      action: {
        type: 'longRest',
        actorInstanceId: 'r1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    Restoration.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Restoration',
          key: 'restorationTokens',
          value: 3,
        }),
      })
    );
  });

  it('onRest (short rest) does not refresh tokens', () => {
    const char = mockCharacter({
      instanceId: 'r2',
      spellcastTrait: 'presence',
      traits: { presence: 3 },
    });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'r2',
      _featureKey: 'Restoration',
      featureState: { Restoration: { restorationTokens: 5 } },
      action: {
        type: 'shortRest',
        actorInstanceId: 'r2',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    Restoration.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m.filter((x) => x.type === 'setFeatureState')).toHaveLength(0);
  });

  it('Clear Hit Points chip spends 1 token and clears 2 HP on a touched target in Melee', () => {
    const healer = mockCharacter({
      instanceId: 'h1',
      spellcastTrait: 'presence',
      traits: { presence: 2 },
      tokenX: 0,
      tokenY: 0,
    });
    const ally = mockCharacter({
      instanceId: 'a1',
      name: 'Ally',
      tokenX: 5,
      tokenY: 0,
      currentHp: 2,
      maxHp: 6,
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [healer, ally],
        _ownerInstanceId: 'h1',
        _featureKey: 'Restoration',
        featureState: { Restoration: { restorationTokens: 2 } },
        action: {
          type: 'free',
          actorInstanceId: 'h1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...Restoration, _ownerInstanceId: 'h1' }], 'card', tbl);
    const healChip = chips.find((c) => c.name === 'Restoration — Clear Hit Points');
    const fromUse = activateChip(healChip, tbl, makeChipState(), { selectedTargetIds: ['a1'] });
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'restorationTokens', value: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: { instanceId: 'a1', amount: 2 },
      })
    );
  });

  it('Clear Hit Points chip is disabled with no tokens', () => {
    const healer = mockCharacter({ instanceId: 'h2', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'a2', tokenX: 4, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [healer, ally],
        _ownerInstanceId: 'h2',
        _featureKey: 'Restoration',
        featureState: { Restoration: { restorationTokens: 0 } },
        action: {
          type: 'free',
          actorInstanceId: 'h2',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...Restoration, _ownerInstanceId: 'h2' }], 'card', tbl);
    const healChip = chips.find((c) => c.name === 'Restoration — Clear Hit Points');
    expect(healChip?.disabled).toBe(true);
  });
});

describe('Splendor Tier 2 — Life Ward', () => {
  it('onReviewOutcome reduces lethal stat:currentHP on warded ally to leave 1 HP and clears ward', () => {
    const caster = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({
      instanceId: 'a1',
      name: 'Warded',
      currentHp: 4,
      maxHp: 6,
      tokenX: 5,
      tokenY: 0,
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 10, tokenY: 0 });
    const effects = [
      {
        stat: 'currentHP',
        target: { instanceId: 'a1', elementType: 'character', name: 'Warded' },
        amount: 4,
      },
    ];
    const { mutations, narrations } = runReviewOutcome({ ...LifeWard, _ownerInstanceId: 'c1' }, {
      activeElements: [caster, ally, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Life Ward',
      featureState: { 'Life Ward': { lifeWardTargetId: 'a1' } },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['a1'],
        effects,
        appliedEffects: [],
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });
    expect(effects[0].amount).toBe(3);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Life Ward',
          key: 'lifeWardTargetId',
          value: null,
        }),
      })
    );
    expect(narrations.length).toBeGreaterThan(0);
  });

  it('onReviewOutcome reduces lethal type:damage on warded ally to leave 1 HP and clears ward', () => {
    const caster = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({
      instanceId: 'a1',
      name: 'Warded',
      currentHp: 2,
      maxHp: 6,
      tokenX: 5,
      tokenY: 0,
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 10, tokenY: 0 });
    const effects = [
      {
        type: 'damage',
        damageType: 'physical',
        target: { instanceId: 'a1', elementType: 'character', name: 'Warded' },
        amount: 2,
      },
    ];
    const { mutations } = runReviewOutcome({ ...LifeWard, _ownerInstanceId: 'c1' }, {
      activeElements: [caster, ally, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Life Ward',
      featureState: { 'Life Ward': { lifeWardTargetId: 'a1' } },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['a1'],
        effects,
        appliedEffects: [],
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });
    expect(effects[0].amount).toBe(1);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Life Ward',
          key: 'lifeWardTargetId',
          value: null,
        }),
      })
    );
  });
});

describe('Splendor Tier 2 — Overwhelming Aura', () => {
  const feat = { ...OverwhelmingAura, _ownerInstanceId: 'char-1' };

  it('main card queues Spellcast (15) actionLoop', () => {
    const tbl = freeActionTable('oa1', 'Overwhelming Aura');
    const chips = collectChips([{ ...OverwhelmingAura, _ownerInstanceId: 'oa1' }], 'card', tbl);
    const main = chips.find((c) => c.name === 'Overwhelming Aura');
    const m = activateChip(main, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Overwhelming Aura', difficulty: 15 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'oaAwaitingSpellcast', value: true }),
      })
    );
  });

  it('successful Spellcast sets oaAwaitingHope', () => {
    const { mutations } = runReviewAction(feat, {
      actionType: 'spellcast',
      action: {
        type: 'spellcast',
        actorInstanceId: 'char-1',
        targetInstanceIds: [],
      },
      rolls: mockRoll({ isSuccess: true }),
      featureState: { 'Overwhelming Aura': { oaAwaitingSpellcast: true } },
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Overwhelming Aura',
          key: 'oaAwaitingHope',
          value: true,
        }),
      })
    );
  });

  it('Empower aura chip spends 2 Hope and activates the aura', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'char-1', hope: 4 })],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Overwhelming Aura',
        featureState: { 'Overwhelming Aura': { oaAwaitingHope: true } },
        action: {
          type: 'free',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([feat], 'card', tbl);
    const empower = chips.find((c) => c.name === 'Empower aura');
    expect(empower?.hopeCost).toBe(2);
    const m = activateChip(empower, tbl, makeChipState());
    deductChipCosts(empower, tbl);
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
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'overwhelmingAuraActive',
          value: true,
        }),
      })
    );
  });

  it('applyDeclarativeFeatures adds Presence to match Spellcast while aura is active', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      spellcastTrait: 'knowledge',
      traits: {
        presence: 1,
        knowledge: 3,
        agility: 0,
        strength: 0,
        finesse: 0,
        instinct: 0,
      },
      featureState: { 'Overwhelming Aura': { overwhelmingAuraActive: true } },
    });
    const out = applyDeclarativeFeatures([feat], char, {});
    expect(out.stats.presence).toBe(3);
  });

  it('onReviewAction marks Stress on attacker adversary when aura is active', () => {
    const pc = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations, narrations } = runReviewAction(feat, {
      activeElements: [pc, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      featureState: { 'Overwhelming Aura': { overwhelmingAuraActive: true } },
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'adv-1', amount: 1 }),
      })
    );
    expect(narrations.some((n) => n.includes('Overwhelming Aura'))).toBe(true);
  });

  it('onRest (long rest) clears aura flags', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Overwhelming Aura',
      featureState: {
        'Overwhelming Aura': {
          overwhelmingAuraActive: true,
          oaAwaitingHope: true,
          oaAwaitingSpellcast: true,
        },
      },
      action: {
        type: 'longRest',
        actorInstanceId: 'char-1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    const restHook = unwrap(OverwhelmingAura.hooks.onRest, tbl);
    expect(typeof restHook).toBe('function');
    restHook(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'overwhelmingAuraActive', value: false }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'oaAwaitingHope', value: false }),
      })
    );
  });
});

describe('Splendor Tier 2 — Salvation Beam', () => {
  const feat = { ...SalvationBeam, _ownerInstanceId: 'char-1' };

  it('main card spends 2 Hope (recall), queues Spellcast (16), sets sbAwaitingSpellcast', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'char-1', hope: 5 })],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Salvation Beam',
        action: {
          type: 'free',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([feat], 'card', tbl);
    const main = chips.find((c) => c.name === 'Salvation Beam');
    expect(main?.hopeCost).toBe(2);
    const m = activateChip(main, tbl, makeChipState());
    deductChipCosts(main, tbl);
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
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Salvation Beam', difficulty: 16 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'sbAwaitingSpellcast', value: true }),
      })
    );
  });

  it('successful Spellcast sets sbPendingHeal', () => {
    const { mutations } = runReviewAction(feat, {
      actionType: 'spellcast',
      action: mockAction({ type: 'spellcast', actorInstanceId: 'char-1', targetInstanceIds: [] }),
      rolls: mockRoll({ isSuccess: true }),
      featureState: { 'Salvation Beam': { sbAwaitingSpellcast: true } },
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Salvation Beam',
          key: 'sbPendingHeal',
          value: true,
        }),
      })
    );
  });

  it('failed Spellcast does not set sbPendingHeal', () => {
    const { mutations } = runReviewAction(feat, {
      actionType: 'spellcast',
      action: mockAction({ type: 'spellcast', actorInstanceId: 'char-1', targetInstanceIds: [] }),
      rolls: mockRoll({ isSuccess: false }),
      featureState: { 'Salvation Beam': { sbAwaitingSpellcast: true } },
    });
    expect(mutations).not.toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'sbPendingHeal', value: true }),
      })
    );
  });

  it('Distribute healing marks Stress and clears HP split across selected allies', () => {
    const c1 = mockCharacter({
      instanceId: 'char-1',
      tokenX: 0,
      tokenY: 0,
      currentStress: 0,
      hope: 5,
    });
    const c2 = mockCharacter({
      instanceId: 'char-2',
      tokenX: 25,
      tokenY: 0,
      currentStress: 0,
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [c1, c2],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Salvation Beam',
        featureState: { 'Salvation Beam': { sbPendingHeal: true } },
        action: {
          type: 'free',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([feat], 'card', tbl);
    const dist = chips.find((c) => c.name === 'Salvation Beam — Distribute healing');
    expect(dist?.name).toBe('Salvation Beam — Distribute healing');
    const m = activateChip(dist, tbl, makeChipState(), {
      selectedId: '2',
      selectedTargetIds: ['char-1', 'char-2'],
    });
    const applied = applyMutations(tbl);
    const all = [...m, ...applied];
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 2 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: expect.objectContaining({ instanceId: 'char-2', amount: 1 }),
      })
    );
  });
});
