import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import {
  activateChip,
  collectChips,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import {
  ElementalIncarnation,
  ElementalAura,
  ElementalDominion,
} from '../../../../src/features-v2/subclasses/WardenOfTheElements.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockAction,
  mockRoll,
  runReviewAction,
  runIntent,
} from '../helpers.js';

/** Production `loadCharacterFeatures` sets `_sourceObject` from the registry row (which has `sourceScopeKey`). Tests that call `buildTableSnapshot` without the loader need this stub for `table.source.set`. */
const WARDEN_SUBCLASS_ROW = { sourceScopeKey: 'WardenOfTheElements' };

describe('Warden of the Elements — Elemental Incarnation', () => {
  const annotated = {
    ...ElementalIncarnation,
    _ownerInstanceId: 'w1',
    _sourceObject: WARDEN_SUBCLASS_ROW,
  };

  it('card isSelect marks Stress and sets channeled element in feature state', () => {
    const w = mockCharacter({
      instanceId: 'w1',
      currentStress: 0,
      maxStress: 6,
      tokenX: 0,
      tokenY: 0,
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [w],
        _ownerInstanceId: 'w1',
        _featureKey: 'Elemental Incarnation',
        _activeFeature: annotated,
        featureState: {},
        action: {
          type: 'free',
          actorInstanceId: 'w1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([annotated], 'card', tbl);
    expect(chips).toHaveLength(1);
    const fromUse = activateChip(chips[0], tbl, makeChipState(), { selectedId: 'earth' });
    deductChipCosts(chips[0], tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'WardenOfTheElements',
          key: 'channeledElement',
          value: 'earth',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'w1', amount: 1 }),
      })
    );
  });

  it('Air channel: intent queues exactly one advantage die on Agility (CONV-003 — no duplicate with declarative triggers)', () => {
    const w = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 0, tokenY: 0 });
    const { mutations } = runIntent(
      { ...ElementalIncarnation, _ownerInstanceId: 'char-1' },
      {
        activeElements: [w, adv],
        featureState: { WardenOfTheElements: { channeledElement: 'air' } },
        action: mockAction({ type: 'attack', traitKey: 'Agility', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
        rolls: mockRoll(),
      }
    );
    const advMutations = mutations.filter(
      (m) => m.type === 'addAdvantageDie' && m.payload?.name === 'Elemental Incarnation (Air)'
    );
    expect(advMutations).toHaveLength(1);
  });

  it('Earth channel adds Proficiency to Major and Severe thresholds (declarative)', () => {
    const char = {
      ...mockCharacter({
        instanceId: 'w1',
        subclassId: 'srd-sub-warden-of-the-elements',
        proficiency: 2,
        armorThresholds: { major: 5, severe: 8 },
      }),
      featureState: { WardenOfTheElements: { channeledElement: 'earth' } },
    };
    const table = { featureState: char.featureState };
    const { stats } = applyDeclarativeFeatures([ElementalIncarnation], char, table);
    expect(stats.majorThreshold).toBe(7);
    expect(stats.severeThreshold).toBe(10);
  });

  it('Fire channel: when adversary in Melee deals damage, queues 1d10 magic retaliation', () => {
    const w = mockCharacter({ instanceId: 'w1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 4, tokenY: 0 });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'w1' },
        amount: 2,
        damageType: 'physical',
      },
    ];
    const { mutations } = runReviewAction(
      { ...ElementalIncarnation, _ownerInstanceId: 'w1' },
      {
        activeElements: [w, adv],
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['w1'],
          effects,
        },
        featureState: { WardenOfTheElements: { channeledElement: 'fire' } },
        rolls: { action: { isSuccess: true }, damage: {} },
      }
    );
    const pushed = effects.find((e) => e.damageType === 'magic' && e.target?.instanceId === 'adv-1');
    expect(pushed).toBeDefined();
    expect(typeof pushed.amount).toBe('number');
    expect(mutations.some((m) => m.type === 'rollDie')).toBe(true);
  });

  it('Fire channel: no retaliation when adversary is not in Melee range', () => {
    const w = mockCharacter({ instanceId: 'w1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 200, tokenY: 0 });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'w1' },
        amount: 2,
        damageType: 'physical',
      },
    ];
    const beforeLen = effects.length;
    runReviewAction(
      { ...ElementalIncarnation, _ownerInstanceId: 'w1' },
      {
        activeElements: [w, adv],
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['w1'],
          effects,
        },
        featureState: { WardenOfTheElements: { channeledElement: 'fire' } },
        rolls: { action: { isSuccess: true }, damage: {} },
      }
    );
    expect(effects.length).toBe(beforeLen);
    expect(effects.some((e) => e.damageType === 'magic')).toBe(false);
  });
});

describe('Warden of the Elements — Elemental Aura (Air)', () => {
  it('Air aura: reduces non-Melee attack damage to the warden', () => {
    const w = mockCharacter({ instanceId: 'w1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 40, tokenY: 0 });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'w1' },
        amount: 10,
        damageType: 'physical',
      },
    ];
    runReviewAction(
      { ...ElementalIncarnation, _ownerInstanceId: 'w1' },
      {
        activeElements: [w, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['w1'],
          effects,
        },
        featureState: { WardenOfTheElements: { channeledElement: 'air', auraActive: true } },
        rolls: { action: { isSuccess: true }, damage: {} },
        _rng: () => 0,
      }
    );
    expect(effects[0].amount).toBe(9);
  });

  it('Air aura: reduces non-Melee attack damage to an ally within Close of the warden', () => {
    const w1 = mockCharacter({ instanceId: 'w1', tokenX: 0, tokenY: 0 });
    const w2 = mockCharacter({ instanceId: 'w2', tokenX: 8, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 40, tokenY: 0 });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'w2' },
        amount: 10,
        damageType: 'physical',
      },
    ];
    runReviewAction(
      { ...ElementalIncarnation, _ownerInstanceId: 'w1' },
      {
        activeElements: [w1, w2, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['w2'],
          effects,
        },
        featureState: { WardenOfTheElements: { channeledElement: 'air', auraActive: true } },
        rolls: { action: { isSuccess: true }, damage: {} },
        _rng: () => 0,
      }
    );
    expect(effects[0].amount).toBe(9);
  });

  it('Air aura: no reduction for an ally outside Close of the warden', () => {
    const w1 = mockCharacter({ instanceId: 'w1', tokenX: 0, tokenY: 0 });
    const w2 = mockCharacter({ instanceId: 'w2', tokenX: 120, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 160, tokenY: 0 });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'w2' },
        amount: 10,
        damageType: 'physical',
      },
    ];
    runReviewAction(
      { ...ElementalIncarnation, _ownerInstanceId: 'w1' },
      {
        activeElements: [w1, w2, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['w2'],
          effects,
        },
        featureState: { WardenOfTheElements: { channeledElement: 'air', auraActive: true } },
        rolls: { action: { isSuccess: true }, damage: {} },
        _rng: () => 0,
      }
    );
    expect(effects[0].amount).toBe(10);
  });
});

describe('Warden of the Elements — Elemental Aura', () => {
  it('aura card is disabled when not channeling', () => {
    const w = mockCharacter({ instanceId: 'w1', tokenX: 0, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [w],
        _ownerInstanceId: 'w1',
        _featureKey: 'Elemental Aura',
        featureState: {},
        action: {
          type: 'free',
          actorInstanceId: 'w1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...ElementalAura, _ownerInstanceId: 'w1' }], 'card', tbl);
    expect(chips[0].disabled).toBe(true);
  });
});

describe('Warden of the Elements — Elemental Dominion', () => {
  it('mastery Air: +1 Evasion while channeling Air (tier 4+)', () => {
    const char = {
      ...mockCharacter({
        instanceId: 'w1',
        tier: 4,
        evasion: 12,
        subclassId: 'srd-sub-warden-of-the-elements',
      }),
      featureState: { WardenOfTheElements: { channeledElement: 'air' } },
    };
    const { stats } = applyDeclarativeFeatures([ElementalDominion], char, { featureState: char.featureState });
    expect(stats.evasion).toBe(13);
  });

  it('mastery Earth: d6 per HP marked can reduce HP loss (tier 4+)', () => {
    const w = mockCharacter({
      instanceId: 'w1',
      tier: 4,
      tokenX: 0,
      tokenY: 0,
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 0, tokenY: 0 });
    const effects = [
      {
        stat: 'currentHP',
        target: { instanceId: 'w1' },
        amount: 2,
        damageType: 'physical',
      },
    ];
    const gameState = mockGameState({
      activeElements: [w, adv],
      _ownerInstanceId: 'w1',
      _featureKey: 'Elemental Dominion',
      featureState: { WardenOfTheElements: { channeledElement: 'earth' } },
      _rng: () => 0.999,
    });
    const loop = createActionLoop(
      gameState,
      mockAction({
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['w1'],
      }),
      [{ ...ElementalDominion, _ownerInstanceId: 'w1' }],
      {}
    );
    loop.setEffects(effects);
    loop.runPhase('reviewOutcome');
    expect(effects[0].amount).toBe(0);
  });
});
