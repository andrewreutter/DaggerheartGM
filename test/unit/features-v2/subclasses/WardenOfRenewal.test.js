import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import {
  ClarityOfNature,
  Regeneration,
  RegenerativeReach,
  WardensProtection,
  Defender,
} from '../../../../src/features-v2/subclasses/WardenOfRenewal.js';
import { mockCharacter, mockGameState, mockAdversary, mockAdversaryAttackRoll, runReviewAction } from '../helpers.js';

describe('Warden of Renewal — Defender', () => {
  const annotated = { ...Defender, _ownerInstanceId: 'h1' };

  it('reviewAction: in Beastform, ally in Close with ≥2 pending HP — chip reduces damage by 1 and marks Stress', () => {
    const warden = mockCharacter({
      instanceId: 'h1',
      subclassId: 'srd-sub-warden-of-renewal',
      currentStress: 0,
      maxStress: 6,
      tokenX: 0,
      tokenY: 0,
      activeBeastform: { beastformId: 'srd-bf-test', id: 'bf1' },
    });
    const ally = mockCharacter({
      instanceId: 'a1',
      tokenX: 4,
      tokenY: 0,
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 20, tokenY: 0 });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'a1' },
        amount: 3,
        damageType: 'physical',
      },
    ];

    const { chips } = runReviewAction(annotated, {
      activeElements: [warden, ally, adv],
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['a1'],
        trait: 'Agility',
        range: 'melee',
        effects,
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });

    expect(chips.filter((c) => c.name === 'Defender')).toHaveLength(1);
    const chip = chips.find((c) => c.name === 'Defender');
    expect(chip.stressCost).toBe(1);

    const gs = mockGameState({
      activeElements: [warden, ally, adv],
      _ownerInstanceId: 'h1',
      _featureKey: 'Defender',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['a1'],
        trait: 'Agility',
        range: 'melee',
        effects,
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const fromUse = activateChip(chip, tbl, makeChipState(), { selectedTargetIds: ['a1'] });
    deductChipCosts(chip, tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];

    expect(effects[0].amount).toBe(2);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'h1', amount: 1 }),
      })
    );
  });

  it('does not offer Defender when not in Beastform', () => {
    const warden = mockCharacter({
      instanceId: 'h1',
      tokenX: 0,
      tokenY: 0,
    });
    const ally = mockCharacter({ instanceId: 'a1', tokenX: 4, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewAction(annotated, {
      activeElements: [warden, ally, adv],
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['a1'],
        effects: [
          { type: 'damage', target: { instanceId: 'a1' }, amount: 3, damageType: 'physical' },
        ],
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });
    expect(chips.filter((c) => c.name === 'Defender')).toHaveLength(0);
  });

  it('does not offer Defender when ally would mark fewer than 2 HP', () => {
    const warden = mockCharacter({
      instanceId: 'h1',
      tokenX: 0,
      tokenY: 0,
      activeBeastform: { beastformId: 'srd-bf-test', id: 'bf1' },
    });
    const ally = mockCharacter({ instanceId: 'a1', tokenX: 4, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewAction(annotated, {
      activeElements: [warden, ally, adv],
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['a1'],
        effects: [
          { type: 'damage', target: { instanceId: 'a1' }, amount: 1, damageType: 'physical' },
        ],
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });
    expect(chips.filter((c) => c.name === 'Defender')).toHaveLength(0);
  });
});

describe('Warden of Renewal — Regeneration', () => {
  const annotated = { ...Regeneration, _ownerInstanceId: 'h1' };

  it('card: spend 3 Hope, roll d4, clear HP on one ally at Melee (tier 1)', () => {
    const healer = mockCharacter({
      instanceId: 'h1',
      subclassId: 'srd-sub-warden-of-renewal',
      tier: 1,
      hope: 5,
      tokenX: 0,
      tokenY: 0,
    });
    const ally = mockCharacter({
      instanceId: 'a1',
      currentHp: 1,
      maxHp: 6,
      tokenX: 0,
      tokenY: 4,
    });
    const gs = mockGameState({
      activeElements: [healer, ally],
      _ownerInstanceId: 'h1',
      _featureKey: 'Regeneration',
      featureState: { Regeneration: {} },
      _rng: () => 0.99,
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([annotated], 'card', tbl);
    expect(chips).toHaveLength(1);
    expect(chips[0].disabled).toBe(false);

    const fromUse = activateChip(chips[0], tbl, makeChipState(), { selectedTargetIds: ['a1'] });
    deductChipCosts(chips[0], tbl);
    const fromCost = applyMutations(tbl);
    const mutations = [...fromUse, ...fromCost];

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'h1', amount: 3 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd4', total: 4 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: expect.objectContaining({ instanceId: 'a1', amount: 4 }),
      })
    );
  });

  it('tier 1: ally at Very Close is excluded (self at Melee remains a valid target)', () => {
    const healer = mockCharacter({
      instanceId: 'h1',
      subclassId: 'srd-sub-warden-of-renewal',
      tier: 1,
      tokenX: 0,
      tokenY: 0,
    });
    const ally = mockCharacter({
      instanceId: 'a1',
      tokenX: 8,
      tokenY: 0,
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [healer, ally],
        _ownerInstanceId: 'h1',
        _featureKey: 'Regeneration',
      })
    );
    const chips = collectChips([annotated], 'card', tbl);
    const targets = chips[0].selectTargets(tbl);
    expect(targets.some((c) => c.instanceId === 'a1')).toBe(false);
    expect(targets.some((c) => c.instanceId === 'h1')).toBe(true);
  });

  it('tier 3: ally at Very Close is a valid target (Regenerative Reach progression)', () => {
    const healer = mockCharacter({
      instanceId: 'h1',
      subclassId: 'srd-sub-warden-of-renewal',
      tier: 3,
      hope: 5,
      tokenX: 0,
      tokenY: 0,
    });
    const ally = mockCharacter({
      instanceId: 'a1',
      currentHp: 1,
      maxHp: 6,
      tokenX: 8,
      tokenY: 0,
    });
    const gs = mockGameState({
      activeElements: [healer, ally],
      _ownerInstanceId: 'h1',
      _featureKey: 'Regeneration',
      featureState: { Regeneration: {} },
      _rng: () => 0,
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([annotated], 'card', tbl);
    expect(chips[0].disabled).toBe(false);
    const fromUse = activateChip(chips[0], tbl, makeChipState(), { selectedTargetIds: ['a1'] });
    deductChipCosts(chips[0], tbl);
    const fromCost = applyMutations(tbl);
    const mutations = [...fromUse, ...fromCost];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd4', total: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: expect.objectContaining({ instanceId: 'a1', amount: 1 }),
      })
    );
  });
});

describe('Warden of Renewal — Regenerative Reach', () => {
  it('is narrative-only (range extension lives on Regeneration)', () => {
    expect(RegenerativeReach.hooks).toBeUndefined();
    expect(RegenerativeReach.chips).toBeUndefined();
    expect(RegenerativeReach.name).toBe('Regenerative Reach');
  });
});

describe('Warden of Renewal — Clarity of Nature', () => {
  const annotated = { ...ClarityOfNature, _ownerInstanceId: 'w1' };

  it('long-rest card queues actionLoop with Instinct total in the prompt', () => {
    const w = mockCharacter({
      instanceId: 'w1',
      traits: { instinct: 3 },
      tokenX: 0,
      tokenY: 0,
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [w],
        _ownerInstanceId: 'w1',
        _featureKey: 'Clarity of Nature',
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
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'w1',
          title: 'Clarity of Nature',
          description: expect.stringContaining('3'),
        }),
      })
    );
  });
});

describe('Warden of Renewal — Warden\'s Protection', () => {
  const annotated = { ...WardensProtection, _ownerInstanceId: 'w1' };

  it('spends 2 Hope, rolls d4, clears 2 HP on each of up to N allies in Close (slice to roll)', () => {
    const w = mockCharacter({
      instanceId: 'w1',
      hope: 5,
      tokenX: 0,
      tokenY: 0,
      subclassId: 'srd-sub-warden-of-renewal',
    });
    const a1 = mockCharacter({
      instanceId: 'a1',
      currentHp: 1,
      maxHp: 6,
      tokenX: 0,
      tokenY: 4,
    });
    const a2 = mockCharacter({
      instanceId: 'a2',
      currentHp: 0,
      maxHp: 6,
      tokenX: 0,
      tokenY: 4,
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [w, a1, a2],
        _ownerInstanceId: 'w1',
        _featureKey: "Warden's Protection",
        _rng: () => 0.3,
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
    expect(chips[0].disabled).toBe(false);
    const fromUse = activateChip(chips[0], tbl, makeChipState(), {
      selectedTargetIds: ['a1', 'a2'],
    });
    deductChipCosts(chips[0], tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'w1', amount: 2 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd4', total: 2 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: expect.objectContaining({ instanceId: 'a1', amount: 2 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: expect.objectContaining({ instanceId: 'a2', amount: 2 }),
      })
    );
  });

  it('is disabled when no allies are within Close range', () => {
    const w = mockCharacter({ instanceId: 'w1', tokenX: 0, tokenY: 0 });
    const a1 = mockCharacter({ instanceId: 'a1', tokenX: 500, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [w, a1],
        _ownerInstanceId: 'w1',
        _featureKey: "Warden's Protection",
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
    expect(chips[0].disabled).toBe(true);
  });
});
