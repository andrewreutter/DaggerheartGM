import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { RiseUp } from '../../../../src/features-v2/abilities/Valor/RiseUp.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { ShrugItOff } from '../../../../src/features-v2/abilities/Valor/ShrugItOff.js';
import { Armorer } from '../../../../src/features-v2/abilities/Valor/Armorer.js';
import { SupportTank } from '../../../../src/features-v2/abilities/Valor/SupportTank.js';
import { RousingStrike } from '../../../../src/features-v2/abilities/Valor/RousingStrike.js';
import { Inevitable } from '../../../../src/features-v2/abilities/Valor/Inevitable.js';
import { ValorTouched } from '../../../../src/features-v2/abilities/Valor/ValorTouched.js';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import {
  mockCharacter,
  mockGameState,
  mockAdversary,
  mockRoll,
  mockAction,
  runReviewAction,
  runResolve,
  runIntent,
  runReviewOutcome,
} from '../helpers.js';

describe('Valor Tier 2 — Armorer', () => {
  it('adds +1 Armor Score when armorId is set', () => {
    const { stats } = applyDeclarativeFeatures(
      [{ ...Armorer, _ownerInstanceId: 'v1' }],
      mockCharacter({
        instanceId: 'v1',
        armorId: 'srd-armor-leather',
        armorScore: 2,
      }),
      {},
      null
    );
    expect(stats.armorScore).toBe(3);
  });

  it('does not add Armor Score when unarmored', () => {
    const { stats } = applyDeclarativeFeatures(
      [{ ...Armorer, _ownerInstanceId: 'v1' }],
      mockCharacter({
        instanceId: 'v1',
        armorId: null,
        armorScore: 3,
      }),
      {},
      null
    );
    expect(stats.armorScore).toBe(3);
  });

  it('rest card clears 1 armor slot on each ally and posts actionLoop', () => {
    const me = mockCharacter({ instanceId: 'v1', name: 'Tank' });
    const ally = mockCharacter({ instanceId: 'ally-1', name: 'Ally', currentArmor: 2, maxArmor: 3 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [me, ally],
        _ownerInstanceId: 'v1',
        _featureKey: 'Armorer',
        action: { type: 'free', actorInstanceId: 'v1', targetInstanceIds: [], effects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...Armorer, _ownerInstanceId: 'v1' }], 'card', tbl);
    const allyChip = chips.find((c) => c.name === 'Armorer — allies clear armor');
    expect(allyChip?.frequency).toBe('rest');
    const m = activateChip(allyChip, tbl, makeChipState());
    deductChipCosts(allyChip, tbl);
    const fromCost = applyMutations(tbl);
    const all = [...m, ...fromCost];
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'clearArmor',
        payload: expect.objectContaining({ instanceId: 'ally-1', amount: 1 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Armorer' }),
      })
    );
  });
});

describe('Valor Tier 2 — Rousing Strike', () => {
  it('queues actionLoop on critical attack and marks used for the rest cycle', () => {
    const fs = { 'Rousing Strike': {} };
    const { mutations } = runResolve(
      { ...RousingStrike, _ownerInstanceId: 'v1' },
      {
        activeElements: [mockCharacter({ instanceId: 'v1' }), mockAdversary()],
        featureState: fs,
        rolls: mockRoll({ isSuccess: true, isCritical: true }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Rousing Strike' }),
      })
    );
    expect(fs['Rousing Strike']?.rousingStrikeUsed).toBe(true);
  });

  it('onRest clears the used flag', () => {
    const fs = { 'Rousing Strike': { rousingStrikeUsed: true } };
    runIntent(
      { ...RousingStrike, _ownerInstanceId: 'v1' },
      {
        activeElements: [mockCharacter({ instanceId: 'v1' }), mockAdversary()],
        featureState: fs,
        actionType: 'shortRest',
        action: { type: 'shortRest' },
      }
    );
    expect(fs['Rousing Strike']?.rousingStrikeUsed).toBe(false);
  });
});

describe('Valor Tier 2 — Inevitable', () => {
  it('arms next advantage after a failed action roll resolves', () => {
    const fs = { Inevitable: {} };
    const { mutations } = runResolve(
      { ...Inevitable, _ownerInstanceId: 'v1' },
      {
        activeElements: [mockCharacter({ instanceId: 'v1' }), mockAdversary()],
        featureState: fs,
        rolls: mockRoll({ isSuccess: false }),
      }
    );
    expect(fs.Inevitable?.inevitableNextAdvantage).toBe(true);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Inevitable',
          key: 'inevitableNextAdvantage',
          value: true,
        }),
      })
    );
  });

  it('does not arm advantage when the action roll succeeds', () => {
    const fs = { Inevitable: {} };
    runResolve(
      { ...Inevitable, _ownerInstanceId: 'v1' },
      {
        activeElements: [mockCharacter({ instanceId: 'v1' }), mockAdversary()],
        featureState: fs,
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    expect(fs.Inevitable?.inevitableNextAdvantage).toBeUndefined();
  });

  it('adds an advantage die on intent when armed, then clears pending', () => {
    const char = mockCharacter({ instanceId: 'v1' });
    const adv = mockAdversary();
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'v1',
      featureState: { Inevitable: { inevitableNextAdvantage: true } },
    });
    const feature = { ...Inevitable, _ownerInstanceId: 'v1' };
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'v1', targetInstanceIds: ['adv-1'] }),
      [feature]
    );
    loop.setRolls(mockRoll({ isSuccess: true }));
    const intent = loop.runPhase('intent');
    expect(intent.mutations).toContainEqual(
      expect.objectContaining({
        type: 'addAdvantageDie',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Inevitable' }),
      })
    );
    expect(gs.featureState.Inevitable?.inevitableNextAdvantage).toBe(false);
  });
});

describe('Valor Tier 2 — Rise Up', () => {
  it('adds Proficiency to Severe threshold', () => {
    const { stats } = applyDeclarativeFeatures(
      [{ ...RiseUp, _ownerInstanceId: 'v1' }],
      mockCharacter({ instanceId: 'v1', proficiency: 3, armorThresholds: { major: 10, severe: 20 } }),
      {},
      null
    );
    expect(stats.severeThreshold).toBe(23);
  });

  it('onResolve clears 1 Stress when you mark HP from another creature attack', () => {
    const char = mockCharacter({ instanceId: 'v1', currentStress: 2 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runResolve(
      { ...RiseUp, _ownerInstanceId: 'v1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'v1',
        actionType: 'attack',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['v1'],
          effects: [],
          appliedEffects: [{ stat: 'currentHP', amount: 1, target: char }],
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: expect.objectContaining({ instanceId: 'v1', amount: 1 }),
      })
    );
  });

  it('does not clear Stress when no HP was marked from the attack', () => {
    const char = mockCharacter({ instanceId: 'v1', currentStress: 2 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runResolve(
      { ...RiseUp, _ownerInstanceId: 'v1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'v1',
        actionType: 'attack',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['v1'],
          effects: [],
          appliedEffects: [],
        },
      }
    );
    expect(mutations.filter((m) => m.type === 'clearStress')).toHaveLength(0);
  });

  it('does not clear Stress when you have 0 Stress marked', () => {
    const char = mockCharacter({ instanceId: 'v1', currentStress: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runResolve(
      { ...RiseUp, _ownerInstanceId: 'v1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'v1',
        actionType: 'attack',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['v1'],
          effects: [],
          appliedEffects: [{ stat: 'currentHP', amount: 2, target: char }],
        },
      }
    );
    expect(mutations.filter((m) => m.type === 'clearStress')).toHaveLength(0);
  });
});

describe('Valor Tier 2 — Shrug It Off', () => {
  it('shows reviewOutcome chip for any incoming HP loss when targeted (not only Severe)', () => {
    const char = mockCharacter({ instanceId: 'v1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewOutcome(
      { ...ShrugItOff, _ownerInstanceId: 'v1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'v1',
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['v1'],
          effects: [{ stat: 'currentHP', target: char, amount: 1, source: adv }],
        },
      }
    );
    expect(chips).toHaveLength(1);
    expect(chips[0].placements).toContain('reviewOutcome');
    expect(chips[0].stressCost).toBe(1);
  });

  it('does not show chip when there is no pending damage to you', () => {
    const char = mockCharacter({ instanceId: 'v1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewOutcome(
      { ...ShrugItOff, _ownerInstanceId: 'v1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'v1',
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['v1'],
          effects: [],
        },
      }
    );
    expect(chips).toHaveLength(0);
  });

  it('onUse reduces pending HP by one, marks Stress, and moves card to vault on d6 ≤ 3', () => {
    const char = mockCharacter({ instanceId: 'v1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ stat: 'currentHP', target: char, amount: 2, source: adv }];
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'v1',
      _featureKey: 'Shrug It Off',
      _rng: () => 0.1,
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['v1'],
        effects,
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ShrugItOff, _ownerInstanceId: 'v1' }], 'reviewOutcome', tbl);
    expect(chips).toHaveLength(1);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(effects[0].amount).toBe(1);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'v1', amount: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd6', total: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'domainCardMoveToVault',
        payload: expect.objectContaining({ instanceId: 'v1', cardId: 'srd-abl-shrug-it-off' }),
      })
    );
  });

  it('does not vault when d6 is greater than 3', () => {
    const char = mockCharacter({ instanceId: 'v1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ stat: 'currentHP', target: char, amount: 2, source: adv }];
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'v1',
      _featureKey: 'Shrug It Off',
      _rng: () => 0.85,
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['v1'],
        effects,
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ShrugItOff, _ownerInstanceId: 'v1' }], 'reviewOutcome', tbl);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m.some((x) => x.type === 'domainCardMoveToVault')).toBe(false);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd6', total: 6 }),
      })
    );
  });
});

const fourValor = () => [1, 2, 3, 4].map((i) => ({ id: `va-${i}`, domain: 'valor' }));

describe('Valor Tier 2 — Valor-Touched', () => {
  it('adds +1 Armor Score when 4+ Valor domain cards', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      domainLoadout: fourValor(),
      armorScore: 2,
    });
    const { stats } = applyDeclarativeFeatures([{ ...ValorTouched, _ownerInstanceId: 'c1' }], char, {});
    expect(stats.armorScore).toBe(3);
  });

  it('does not add Armor Score bonus with fewer than 4 Valor cards', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      domainLoadout: [{ id: 'a', domain: 'valor' }],
      armorScore: 2,
    });
    const { stats } = applyDeclarativeFeatures([{ ...ValorTouched, _ownerInstanceId: 'c1' }], char, {});
    expect(stats.armorScore).toBe(2);
  });

  it('onReviewOutcome clears one Armor Slot when taking HP without using armor and a slot is marked', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: fourValor(),
      currentArmor: 2,
      maxArmor: 3,
      armorScore: 1,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewOutcome(
      { ...ValorTouched, _ownerInstanceId: 'char-1' },
      {
        currentActorInstanceId: 'adv-1',
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [{ stat: 'currentHP', target: char, amount: 2 }],
        },
        activeElements: [char, adv],
        rolls: mockRoll(),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearArmor',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
  });

  it('does not clear armor when using armor for the hit', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: fourValor(),
      currentArmor: 2,
      maxArmor: 3,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewOutcome(
      { ...ValorTouched, _ownerInstanceId: 'char-1' },
      {
        currentActorInstanceId: 'adv-1',
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          useArmorByTargetId: { 'char-1': true },
          effects: [{ stat: 'currentHP', target: char, amount: 1 }],
        },
        activeElements: [char, adv],
        rolls: mockRoll(),
      }
    );
    expect(mutations.filter((m) => m.type === 'clearArmor')).toHaveLength(0);
  });

  it('does not clear armor when no marked armor slots remain', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: fourValor(),
      currentArmor: 3,
      maxArmor: 3,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewOutcome(
      { ...ValorTouched, _ownerInstanceId: 'char-1' },
      {
        currentActorInstanceId: 'adv-1',
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [{ stat: 'currentHP', target: char, amount: 2 }],
        },
        activeElements: [char, adv],
        rolls: mockRoll(),
      }
    );
    expect(mutations.filter((m) => m.type === 'clearArmor')).toHaveLength(0);
  });

  it('does not run when fewer than 4 Valor cards', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: [{ id: 'x', domain: 'valor' }],
      currentArmor: 2,
      maxArmor: 3,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewOutcome(
      { ...ValorTouched, _ownerInstanceId: 'char-1' },
      {
        currentActorInstanceId: 'adv-1',
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [{ stat: 'currentHP', target: char, amount: 1 }],
        },
        activeElements: [char, adv],
        rolls: mockRoll(),
      }
    );
    expect(mutations.filter((m) => m.type === 'clearArmor')).toHaveLength(0);
  });
});

describe('Valor Tier 2 — Support Tank', () => {
  const base = {
    activeElements: [
      mockCharacter({ instanceId: 'ally', name: 'Ally', tokenX: 0, tokenY: 0 }),
      mockCharacter({ instanceId: 'tank', name: 'Tank', tokenX: 4, tokenY: 0 }),
    ],
    _ownerInstanceId: 'tank',
    action: {
      actorInstanceId: 'ally',
      targetInstanceIds: ['adv-1'],
    },
    rolls: mockRoll({ isSuccess: false }),
  };

  it('shows reviewAction reroll chips when an ally fails within melee (SRD Close range)', () => {
    const { chips } = runReviewAction({ ...SupportTank, _ownerInstanceId: 'tank' }, base);
    expect(chips.filter((c) => c.name?.startsWith('Support Tank'))).toHaveLength(2);
    expect(chips).toContainEqual(
      expect.objectContaining({ name: 'Support Tank — Reroll Hope', hopeCost: 2 })
    );
    expect(chips).toContainEqual(
      expect.objectContaining({ name: 'Support Tank — Reroll Fear', hopeCost: 2 })
    );
  });

  it('shows chips when ally is within Close band but not only the literal "close" band', () => {
    const { chips } = runReviewAction(
      { ...SupportTank, _ownerInstanceId: 'tank' },
      {
        ...base,
        activeElements: [
          mockCharacter({ instanceId: 'ally', tokenX: 0, tokenY: 0 }),
          mockCharacter({ instanceId: 'tank', tokenX: 20, tokenY: 0 }),
        ],
      }
    );
    expect(chips.filter((c) => c.name?.startsWith('Support Tank'))).toHaveLength(2);
  });

  it('hides chips when ally is beyond Close range', () => {
    const { chips } = runReviewAction(
      { ...SupportTank, _ownerInstanceId: 'tank' },
      {
        ...base,
        activeElements: [
          mockCharacter({ instanceId: 'ally', tokenX: 0, tokenY: 0 }),
          mockCharacter({ instanceId: 'tank', tokenX: 200, tokenY: 0 }),
        ],
      }
    );
    expect(chips.filter((c) => c.name?.startsWith('Support Tank'))).toHaveLength(0);
  });

  it('hides chips when the ally succeeded', () => {
    const { chips } = runReviewAction(
      { ...SupportTank, _ownerInstanceId: 'tank' },
      { ...base, rolls: mockRoll({ isSuccess: true }) }
    );
    expect(chips.filter((c) => c.name?.startsWith('Support Tank'))).toHaveLength(0);
  });

  it('Reroll Hope chip spends 2 Hope and queues rerollDie for the ally action roll', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        ...base,
        action: {
          type: 'attack',
          actorInstanceId: 'ally',
          targetInstanceIds: ['adv-1'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
        _featureKey: 'Support Tank',
      })
    );
    const collected = collectChips([{ ...SupportTank, _ownerInstanceId: 'tank' }], 'reviewAction', tbl);
    const chip = collected.find((c) => c.name === 'Support Tank — Reroll Hope');
    const fromChip = activateChip(chip, tbl, makeChipState());
    deductChipCosts(chip, tbl);
    const mut = [...fromChip, ...applyMutations(tbl)];
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'tank', amount: 2 }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: expect.objectContaining({ rollKey: 'action', dieType: 'hopeDie' }),
      })
    );
  });
});
