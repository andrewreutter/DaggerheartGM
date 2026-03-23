import { describe, it, expect } from 'vitest';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { Redirect } from '../../../../src/features-v2/abilities/Bone/Redirect.js';
import { RapidRiposte } from '../../../../src/features-v2/abilities/Bone/RapidRiposte.js';
import { Boost } from '../../../../src/features-v2/abilities/Bone/Boost.js';
import { BoneTouched } from '../../../../src/features-v2/abilities/Bone/BoneTouched.js';
import { CruelPrecision } from '../../../../src/features-v2/abilities/Bone/CruelPrecision.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockAdversaryAttackRoll,
  mockAction,
  mockRoll,
  runIntent,
  runReviewAction,
} from '../helpers.js';

const fourBoneCards = () => [1, 2, 3, 4].map((i) => ({ id: `bone-${i}`, domain: 'bone' }));

function baseRedirectGameState(rngSeq, rollOverrides = {}) {
  const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0, proficiency: 2 });
  const atk = mockAdversary({ instanceId: 'a1', tokenX: 20, tokenY: 0 });
  const vic = mockAdversary({ instanceId: 'a2', tokenX: 8, tokenY: 0 });
  let idx = 0;
  return mockGameState({
    activeElements: [char, atk, vic],
    _ownerInstanceId: 'c1',
    _featureKey: 'Redirect',
    featureState: { Redirect: {} },
    currentActorInstanceId: 'c1',
    action: {
      type: 'attack',
      actorInstanceId: 'a1',
      targetInstanceIds: ['c1'],
      effects: [],
    },
    rolls: mockAdversaryAttackRoll({
      isSuccess: false,
      damage: { dice: [{ name: 'w', die: 'd10', value: 3 }] },
      ...rollOverrides,
    }),
    _rng: () => rngSeq[idx++] ?? 0.1,
  });
}

describe('Bone Tier 2 — Redirect', () => {
  it('onReviewAction rolls Proficiency d6s and sets redirectAnySix when any die is a 6', () => {
    const gs = baseRedirectGameState([0.99, 0.1]);
    const loop = createActionLoop(gs, mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }), [
      { ...Redirect, _ownerInstanceId: 'c1' },
    ]);
    loop.setRolls(gs.rolls);
    const ra = loop.runPhase('reviewAction');
    expect(gs.featureState.Redirect?.redirectAnySix).toBe(true);
    expect(ra.mutations.filter((m) => m.type === 'rollDie').length).toBe(2);
    expect(ra.mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Redirect',
          key: 'redirectAnySix',
          value: true,
        }),
      })
    );
  });

  it('does not arm the chip when no d6 shows a 6', () => {
    const gs = baseRedirectGameState([0.01, 0.01]);
    const loop = createActionLoop(gs, mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }), [
      { ...Redirect, _ownerInstanceId: 'c1' },
    ]);
    loop.setRolls(gs.rolls);
    loop.runPhase('reviewAction');
    const tbl = buildTableSnapshot({
      ...loop.gameState,
      _ownerInstanceId: 'c1',
      _featureKey: 'Redirect',
    });
    const chips = collectChips([{ ...Redirect, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    expect(chips.filter((c) => c.name === 'Redirect')).toHaveLength(0);
  });

  it('reviewAction chip queues addDamageRoll to a Very Close adversary and Stress via chip cost', () => {
    const gs = baseRedirectGameState([0.99, 0.1]);
    const loop = createActionLoop(gs, mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }), [
      { ...Redirect, _ownerInstanceId: 'c1' },
    ]);
    loop.setRolls(gs.rolls);
    loop.runPhase('reviewAction');
    const tbl = buildTableSnapshot({
      ...loop.gameState,
      _ownerInstanceId: 'c1',
      _featureKey: 'Redirect',
    });
    const chips = collectChips([{ ...Redirect, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    const red = chips.find((c) => c.name === 'Redirect');
    expect(red).toBeDefined();
    expect(red.stressCost).toBe(1);
    const fromUse = activateChip(red, tbl, makeChipState(), { selectedTargetIds: ['a2'] });
    deductChipCosts(red, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addDamageRoll',
        payload: expect.objectContaining({
          name: 'Redirect',
          dice: '1d10',
          targetInstanceIds: ['a2'],
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
  });

  it('onResolve clears redirectAnySix', () => {
    const gs = baseRedirectGameState([0.99, 0.1]);
    gs.featureState.Redirect = { redirectAnySix: true };
    const loop = createActionLoop(gs, mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }), [
      { ...Redirect, _ownerInstanceId: 'c1' },
    ]);
    loop.setRolls(gs.rolls);
    loop.runPhase('resolve');
    expect(gs.featureState.Redirect?.redirectAnySix).toBe(false);
  });
});

function baseRapidRiposteGameState(rollOverrides = {}, pos = {}) {
  const char = mockCharacter({
    instanceId: 'c1',
    tokenX: pos.charX ?? 0,
    tokenY: pos.charY ?? 0,
    weapons: [{ id: 'w1', name: 'Longsword', damage: 'd8' }],
  });
  const atk = mockAdversary({
    instanceId: 'a1',
    tokenX: pos.atkX ?? 4,
    tokenY: pos.atkY ?? 0,
  });
  return mockGameState({
    activeElements: [char, atk],
    _ownerInstanceId: 'c1',
    _featureKey: 'RapidRiposte',
    currentActorInstanceId: 'a1',
    action: {
      type: 'attack',
      actorInstanceId: 'a1',
      targetInstanceIds: ['c1'],
      effects: [],
    },
    rolls: mockAdversaryAttackRoll({
      isSuccess: false,
      gmValue: 8,
      ...rollOverrides,
    }),
  });
}

describe('Bone Tier 2 — Rapid Riposte', () => {
  it('onReviewAction exposes a reviewAction chip when a melee-range attack vs you fails', () => {
    const gs = baseRapidRiposteGameState();
    const loop = createActionLoop(gs, mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }), [
      { ...RapidRiposte, _ownerInstanceId: 'c1' },
    ]);
    loop.setRolls(gs.rolls);
    loop.runPhase('reviewAction');
    const tbl = buildTableSnapshot({
      ...loop.gameState,
      _ownerInstanceId: 'c1',
      _featureKey: 'RapidRiposte',
    });
    const chips = collectChips([{ ...RapidRiposte, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    const rr = chips.find((c) => c.name === 'Rapid Riposte');
    expect(rr).toBeDefined();
    expect(rr.stressCost).toBe(1);
    expect(typeof rr.isSelect).toBe('function');
  });

  it('does not offer the chip when the attack succeeded', () => {
    const gs = baseRapidRiposteGameState({ isSuccess: true, gmValue: 18 });
    const loop = createActionLoop(gs, mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }), [
      { ...RapidRiposte, _ownerInstanceId: 'c1' },
    ]);
    loop.setRolls(gs.rolls);
    loop.runPhase('reviewAction');
    const tbl = buildTableSnapshot({
      ...loop.gameState,
      _ownerInstanceId: 'c1',
      _featureKey: 'RapidRiposte',
    });
    const chips = collectChips([{ ...RapidRiposte, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    expect(chips.filter((c) => c.name === 'Rapid Riposte')).toHaveLength(0);
  });

  it('does not offer the chip when the attack failed from beyond Melee range', () => {
    const gs = baseRapidRiposteGameState({}, { charX: 0, charY: 0, atkX: 30, atkY: 0 });
    const loop = createActionLoop(gs, mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }), [
      { ...RapidRiposte, _ownerInstanceId: 'c1' },
    ]);
    loop.setRolls(gs.rolls);
    loop.runPhase('reviewAction');
    const tbl = buildTableSnapshot({
      ...loop.gameState,
      _ownerInstanceId: 'c1',
      _featureKey: 'RapidRiposte',
    });
    const chips = collectChips([{ ...RapidRiposte, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    expect(chips.filter((c) => c.name === 'Rapid Riposte')).toHaveLength(0);
  });

  it('onUse with selected weapon queues addDamageRoll to the attacker and Stress', () => {
    const gs = baseRapidRiposteGameState();
    const loop = createActionLoop(gs, mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }), [
      { ...RapidRiposte, _ownerInstanceId: 'c1' },
    ]);
    loop.setRolls(gs.rolls);
    loop.runPhase('reviewAction');
    const tbl = buildTableSnapshot({
      ...loop.gameState,
      _ownerInstanceId: 'c1',
      _featureKey: 'RapidRiposte',
    });
    const chips = collectChips([{ ...RapidRiposte, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    const rr = chips.find((c) => c.name === 'Rapid Riposte');
    expect(rr).toBeDefined();
    const fromUse = activateChip(rr, tbl, makeChipState(), { selectedId: 'w1' });
    deductChipCosts(rr, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addDamageRoll',
        payload: expect.objectContaining({
          name: 'Rapid Riposte',
          dice: 'd8',
          targetInstanceIds: ['a1'],
          damageType: 'physical',
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
  });

  it('marks the chip disabled when there are no active weapons', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      tokenX: 0,
      tokenY: 0,
      weapons: [],
    });
    const atk = mockAdversary({ instanceId: 'a1', tokenX: 4, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char, atk],
      _ownerInstanceId: 'c1',
      _featureKey: 'RapidRiposte',
      currentActorInstanceId: 'a1',
      action: {
        type: 'attack',
        actorInstanceId: 'a1',
        targetInstanceIds: ['c1'],
        effects: [],
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: false, gmValue: 6 }),
    });
    const loop = createActionLoop(gs, mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }), [
      { ...RapidRiposte, _ownerInstanceId: 'c1' },
    ]);
    loop.setRolls(gs.rolls);
    loop.runPhase('reviewAction');
    const tbl = buildTableSnapshot({
      ...loop.gameState,
      _ownerInstanceId: 'c1',
      _featureKey: 'RapidRiposte',
    });
    const chips = collectChips([{ ...RapidRiposte, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    const rr = chips.find((c) => c.name === 'Rapid Riposte');
    expect(rr?.disabled).toBe(true);
  });
});

const boostLayout = () => ({
  activeElements: [
    mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 }),
    mockCharacter({ instanceId: 'c2', tokenX: 20, tokenY: 0 }),
    mockAdversary({ instanceId: 'a1', tokenX: 50, tokenY: 0 }),
  ],
  action: {
    type: 'attack',
    actorInstanceId: 'c1',
    targetInstanceIds: ['a1'],
    trait: 'Agility',
    range: 'Far',
    effects: [],
    appliedEffects: [],
  },
  currentActorInstanceId: 'c1',
  rolls: mockRoll(),
});

describe('Bone Tier 2 — Boost', () => {
  it('exposes an intent chip when another PC is within Close and the attack target is Far', () => {
    const { chips } = runIntent({ ...Boost, _ownerInstanceId: 'c1' }, boostLayout());
    const b = chips.find((c) => c.name === 'Boost');
    expect(b).toBeDefined();
    expect(b?.stressCost).toBe(1);
  });

  it('does not expose the intent chip without a second PC ally on the map', () => {
    const { chips } = runIntent(
      { ...Boost, _ownerInstanceId: 'c1' },
      {
        ...boostLayout(),
        activeElements: [
          mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 }),
          mockAdversary({ instanceId: 'a1', tokenX: 50, tokenY: 0 }),
        ],
      }
    );
    expect(chips.filter((c) => c.name === 'Boost')).toHaveLength(0);
  });

  it('does not expose the intent chip when the adversary is not at Far range', () => {
    const { chips } = runIntent(
      { ...Boost, _ownerInstanceId: 'c1' },
      {
        ...boostLayout(),
        activeElements: [
          mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 }),
          mockCharacter({ instanceId: 'c2', tokenX: 20, tokenY: 0 }),
          mockAdversary({ instanceId: 'a1', tokenX: 10, tokenY: 0 }),
        ],
      }
    );
    expect(chips.filter((c) => c.name === 'Boost')).toHaveLength(0);
  });

  it('onUse queues advantage, +d10 damage die, actionLoop narration, and Stress', () => {
    const { chips } = runIntent({ ...Boost, _ownerInstanceId: 'c1' }, boostLayout());
    const b = chips.find((c) => c.name === 'Boost');
    expect(b).toBeDefined();
    const tbl = buildTableSnapshot(
      mockGameState({
        ...boostLayout(),
        _ownerInstanceId: 'c1',
        _featureKey: 'Boost',
      })
    );
    const fromUse = activateChip(b, tbl, makeChipState());
    deductChipCosts(b, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addAdvantageDie',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Boost' }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Boost', die: 'd10' }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Boost' }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
  });
});

describe('Bone Tier 2 — Bone-Touched', () => {
  it('adds +1 Agility when 4+ Bone domain cards are in loadout', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      traits: { agility: 2, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
      domainLoadout: fourBoneCards(),
    });
    const { stats } = applyDeclarativeFeatures([{ ...BoneTouched, _ownerInstanceId: 'c1' }], char, {});
    expect(stats.agility).toBe(3);
  });

  it('does not add Agility bonus when fewer than 4 Bone domain cards', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      traits: { agility: 2, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
      domainLoadout: [{ id: 'b1', domain: 'bone' }],
    });
    const { stats } = applyDeclarativeFeatures([{ ...BoneTouched, _ownerInstanceId: 'c1' }], char, {});
    expect(stats.agility).toBe(2);
  });

  it('offers reviewAction chip on a successful adversary attack vs you when Bone-Touched is active', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 4, domainLoadout: fourBoneCards() });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewAction(
      { ...BoneTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        currentActorInstanceId: 'adv-1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [{ type: 'damage', target: { instanceId: 'char-1' }, amount: 4 }],
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true, gmValue: 16 }),
      }
    );
    const bone = chips.find((c) => c.name === 'Bone-Touched — Attack fails');
    expect(bone).toBeDefined();
    expect(bone?.hopeCost).toBe(3);
  });

  it('onUse flips the attack to a miss, clears pending damage to you, and queues setActionRollSuccess', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 4, domainLoadout: fourBoneCards() });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      currentActorInstanceId: 'adv-1',
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bone-Touched',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [{ type: 'damage', target: { instanceId: 'char-1' }, amount: 4 }],
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true, gmValue: 16 }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...BoneTouched, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const bone = chips.find((c) => c.name === 'Bone-Touched — Attack fails');
    expect(bone).toBeDefined();
    const fromUse = activateChip(bone, tbl, makeChipState());
    deductChipCosts(bone, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setActionRollSuccess',
        payload: expect.objectContaining({ rollKey: 'action', isSuccess: false }),
      })
    );
    expect(gs.rolls.action.isSuccess).toBe(false);
    expect(gs.action.effects[0].amount).toBe(0);
  });

  it('does not offer the chip when the attack did not succeed', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 4, domainLoadout: fourBoneCards() });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewAction(
      { ...BoneTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        currentActorInstanceId: 'adv-1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: false, gmValue: 3 }),
      }
    );
    expect(chips.filter((c) => c.name === 'Bone-Touched — Attack fails')).toHaveLength(0);
  });
});

describe('Bone Tier 2 — Cruel Precision', () => {
  const weaponAction = { weaponId: 'w1', range: 'melee' };

  it('adds the higher of Finesse and Agility to damage on a successful weapon attack', () => {
    const { mutations } = runIntent(
      { ...CruelPrecision, _ownerInstanceId: 'c1' },
      {
        activeElements: [
          mockCharacter({
            instanceId: 'c1',
            traits: { finesse: 2, agility: 3, strength: 0, instinct: 0, presence: 0, knowledge: 0 },
          }),
          mockAdversary(),
        ],
        rolls: mockRoll({ isSuccess: true }),
        action: weaponAction,
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Cruel Precision', value: 3 }),
      })
    );
  });

  it('does not add damage bonus when the attack is not a weapon attack', () => {
    const { mutations } = runIntent(
      { ...CruelPrecision, _ownerInstanceId: 'c1' },
      {
        activeElements: [
          mockCharacter({
            instanceId: 'c1',
            traits: { finesse: 2, agility: 3, strength: 0, instinct: 0, presence: 0, knowledge: 0 },
          }),
          mockAdversary(),
        ],
        rolls: mockRoll({ isSuccess: true }),
        action: { range: 'melee' },
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Cruel Precision')).toHaveLength(0);
  });

  it('does not add damage bonus when the attack fails', () => {
    const { mutations } = runIntent(
      { ...CruelPrecision, _ownerInstanceId: 'c1' },
      {
        activeElements: [
          mockCharacter({
            instanceId: 'c1',
            traits: { finesse: 2, agility: 3, strength: 0, instinct: 0, presence: 0, knowledge: 0 },
          }),
          mockAdversary(),
        ],
        rolls: mockRoll({ isSuccess: false }),
        action: weaponAction,
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Cruel Precision')).toHaveLength(0);
  });
});
