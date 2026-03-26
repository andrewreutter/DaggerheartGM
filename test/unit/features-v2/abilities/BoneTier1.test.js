import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';
import { Untouchable } from '../../../../src/features-v2/abilities/Bone/Untouchable.js';
import { Ferocity } from '../../../../src/features-v2/abilities/Bone/Ferocity.js';
import { StrategicApproach } from '../../../../src/features-v2/abilities/Bone/StrategicApproach.js';
import { Brace } from '../../../../src/features-v2/abilities/Bone/Brace.js';
import { Tactician } from '../../../../src/features-v2/abilities/Bone/Tactician.js';
import { DeftManeuvers } from '../../../../src/features-v2/abilities/Bone/DeftManeuvers.js';
import { KnowThyEnemy } from '../../../../src/features-v2/abilities/Bone/KnowThyEnemy.js';
import { SignatureMove } from '../../../../src/features-v2/abilities/Bone/SignatureMove.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockAction,
  mockRoll,
  runReviewOutcome,
  runReviewAction,
  runIntent,
  runResolve,
} from '../helpers.js';

describe('Bone Tier 1 — Untouchable', () => {
  it('adds half Agility (rounded down) to evasion via passiveStatMods', () => {
    const { stats } = applyDeclarativeFeatures(
      [{ ...Untouchable, _ownerInstanceId: 'b1' }],
      mockCharacter({
        instanceId: 'b1',
        traits: { agility: 5, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
        evasion: 10,
      }),
      {},
      null
    );
    expect(stats.evasion).toBe(12);
  });
});

describe('Bone Tier 1 — Ferocity', () => {
  it('shows reviewOutcome chip when you mark HP on an adversary', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'a1' });
    const { chips } = runReviewOutcome(
      { ...Ferocity, _ownerInstanceId: 'c1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'c1',
        action: {
          type: 'attack',
          actorInstanceId: 'c1',
          targetInstanceIds: ['a1'],
          effects: [{ stat: 'currentHP', target: adv, amount: 2 }],
        },
        actionType: 'attack',
      }
    );
    expect(chips.length).toBeGreaterThanOrEqual(1);
    const fer = chips.find((c) => c.name === 'Ferocity');
    expect(fer).toBeDefined();
    expect(fer.hopeCost).toBe(2);
    expect(fer.placements).toContain('reviewOutcome');
  });

  it('onUse stores ferocityEvasionBonus for passive evasion', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'a1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Ferocity',
      featureState: { Ferocity: {} },
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['a1'],
        effects: [{ stat: 'currentHP', target: adv, amount: 3 }],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Ferocity, _ownerInstanceId: 'c1' }], 'reviewOutcome', tbl);
    expect(chips).toHaveLength(1);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Ferocity',
          key: 'ferocityEvasionBonus',
          value: 3,
        }),
      })
    );
  });

  it('onReviewOutcome clears ferocity bonus when targeted by an attack', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'a1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Ferocity',
      featureState: { Ferocity: { ferocityEvasionBonus: 2 } },
      action: {
        type: 'attack',
        actorInstanceId: 'a1',
        targetInstanceIds: ['c1'],
        effects: [],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const fn = unwrap(Ferocity.hooks.onReviewOutcome, tbl);
    expect(typeof fn).toBe('function');
    fn(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'ferocityEvasionBonus',
          value: 0,
        }),
      })
    );
  });
});

describe('Bone Tier 1 — Strategic Approach', () => {
  it('onRest (long rest) sets tokens to max(1, Knowledge)', () => {
    const char = mockCharacter({
      instanceId: 's1',
      traits: { knowledge: 2, agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0 },
    });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 's1',
      _featureKey: 'Strategic Approach',
      featureState: { 'Strategic Approach': {} },
      action: {
        type: 'longRest',
        actorInstanceId: 's1',
        targetInstanceIds: [],
        effects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    StrategicApproach.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Strategic Approach',
          key: 'strategicApproachTokens',
          value: 2,
        }),
      })
    );
  });

  it('intent chip appears for a Close-band attack vs an adversary with tokens', () => {
    const char = mockCharacter({
      instanceId: 's2',
      tokenX: 0,
      tokenY: 0,
      traits: { knowledge: 2, agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0 },
    });
    const adv = mockAdversary({ instanceId: 'a2', tokenX: 10, tokenY: 0 });
    const { chips } = runIntent(
      { ...StrategicApproach, _ownerInstanceId: 's2' },
      {
        activeElements: [char, adv],
        featureState: {
          'Strategic Approach': {
            strategicApproachTokens: 2,
            strategicApproachUsedAdvIds: {},
          },
        },
        actionType: 'attack',
        action: {
          type: 'attack',
          actorInstanceId: 's2',
          targetInstanceIds: ['a2'],
          range: 'melee',
        },
        rolls: mockRoll(),
      }
    );
    const sa = chips.filter((c) => c.name === 'Strategic Approach');
    expect(sa).toHaveLength(1);
  });
});

describe('Bone Tier 1 — Brace', () => {
  it('reviewAction chip when armor is committed queues markStress + markArmor on use', () => {
    const char = mockCharacter({ instanceId: 'br1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'br1',
      _featureKey: 'Brace',
      action: {
        type: 'attack',
        actorInstanceId: 'x1',
        targetInstanceIds: ['br1'],
        effects: [{ type: 'damage', target: { instanceId: 'br1' }, amount: 4, useArmor: true }],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Brace, _ownerInstanceId: 'br1' }], 'reviewAction', tbl);
    expect(chips).toHaveLength(1);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'br1', amount: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markArmor',
        payload: expect.objectContaining({ instanceId: 'br1', amount: 1 }),
      })
    );
  });
});

describe('Bone Tier 1 — Deft Maneuvers', () => {
  it('card chip is once per rest with Stress cost and Sprint name', () => {
    const char = mockCharacter({ instanceId: 'dm1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'dm1',
      _featureKey: 'Deft Maneuvers',
      featureState: {},
      action: { type: 'trait', actorInstanceId: 'dm1', targetInstanceIds: [], effects: [] },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...DeftManeuvers, _ownerInstanceId: 'dm1' }], 'card', tbl);
    const sprint = chips.find((c) => c.name === 'Sprint (Far)');
    expect(sprint).toBeDefined();
    expect(sprint.frequency).toBe('rest');
    expect(sprint.stressCost).toBe(1);
  });

  it('Sprint (Far): activateChip sets sprint flag, queues actionLoop; deductChipCosts marks Stress', () => {
    const char = mockCharacter({ instanceId: 'dm-sprint' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'dm-sprint',
      _featureKey: 'Deft Maneuvers',
      featureState: {},
      action: { type: 'trait', actorInstanceId: 'dm-sprint', targetInstanceIds: [], effects: [] },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...DeftManeuvers, _ownerInstanceId: 'dm-sprint' }], 'card', tbl);
    const sprint = chips.find((c) => c.name === 'Sprint (Far)');
    expect(sprint).toBeDefined();
    const fromUse = activateChip(sprint, tbl, makeChipState());
    deductChipCosts(sprint, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Deft Maneuvers',
          key: 'deftManeuversNextAttackBonus',
          value: true,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Deft Maneuvers',
          description: expect.stringContaining('Far range'),
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'dm-sprint', amount: 1 }),
      })
    );
  });

  it('onIntent adds +1 to action roll and clears sprint bonus after a Melee attack vs an adversary', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 4, tokenY: 0 });
    const { mutations } = runIntent(
      { ...DeftManeuvers, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        featureState: { 'Deft Maneuvers': { deftManeuversNextAttackBonus: true } },
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          range: 'melee',
        },
        actionType: 'attack',
        rolls: mockRoll(),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ name: 'Deft Maneuvers', value: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Deft Maneuvers',
          key: 'deftManeuversNextAttackBonus',
          value: false,
        }),
      })
    );
  });

  it('onIntent does not add the bonus when sprint flag is not set', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 4, tokenY: 0 });
    const { mutations } = runIntent(
      { ...DeftManeuvers, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        featureState: { 'Deft Maneuvers': {} },
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          range: 'melee',
        },
        actionType: 'attack',
        rolls: mockRoll(),
      }
    );
    expect(
      mutations.filter(
        (m) => m.type === 'addRollStatic' && m.payload?.name === 'Deft Maneuvers'
      )
    ).toHaveLength(0);
  });
});

describe('Bone Tier 1 — Tactician', () => {
  it('reviewAction chip on ally tag team: ally spends Hope and adds static from helper experience', () => {
    const ally = mockCharacter({ instanceId: 'ally-1', hope: 5 });
    const bone = mockCharacter({
      instanceId: 'bone-1',
      experiences: [{ id: 'e1', name: 'Scout', value: 2 }],
    });
    const gs = mockGameState({
      activeElements: [ally, bone],
      _ownerInstanceId: 'ally-1',
      _featureKey: 'Tactician',
      _activeFeature: { ...Tactician, _ownerInstanceId: 'bone-1' },
      featureState: {},
      action: {
        type: 'tagTeam',
        actorInstanceId: 'ally-1',
        targetInstanceIds: ['adv-9'],
        tagTeamPartnerInstanceId: 'bone-1',
        effects: [],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Tactician, _ownerInstanceId: 'bone-1' }], 'reviewAction', tbl);
    expect(chips).toHaveLength(1);
    const fromUse = activateChip(chips[0], tbl, makeChipState(), { selectedId: 'e1' });
    deductChipCosts(chips[0], tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'ally-1', amount: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ name: 'Tactician (Scout)', value: 2 }),
      })
    );
  });
});

describe('Bone Tier 1 — Know Thy Enemy', () => {
  it('card target-select queues Instinct actionLoop vs adversary effective Difficulty', () => {
    const char = mockCharacter({ instanceId: 'kte-1' });
    const adv = mockAdversary({ instanceId: 'adv-kte', difficulty: 12, difficultyMod: 1 });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'kte-1',
      _featureKey: 'Know Thy Enemy',
      featureState: {},
      action: {
        type: 'trait',
        actorInstanceId: 'kte-1',
        targetInstanceIds: [],
        trait: 'Instinct',
        effects: [],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...KnowThyEnemy, _ownerInstanceId: 'kte-1' }], 'card', tbl);
    const card = chips.find((c) => c.name === 'Know Thy Enemy');
    expect(card).toBeDefined();
    const m = [
      ...activateChip(card, tbl, makeChipState(), { selectedTargetIds: ['adv-kte'] }),
      ...applyMutations(tbl),
    ];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Know Thy Enemy',
          trait: 'Instinct',
          difficulty: 13,
        }),
      })
    );
  });

  it('onReviewAction on successful Instinct roll sets ktePostSuccess', () => {
    const char = mockCharacter({ instanceId: 'kte-2' });
    const adv = mockAdversary({ instanceId: 'adv-2' });
    const { mutations } = runReviewAction(
      { ...KnowThyEnemy, _ownerInstanceId: 'kte-2' },
      {
        activeElements: [char, adv],
        featureState: {
          'Know Thy Enemy': { kteAwaiting: true, kteTargetId: 'adv-2' },
        },
        actionType: 'trait',
        action: mockAction({
          type: 'trait',
          actorInstanceId: 'kte-2',
          traitKey: 'Instinct',
          targetInstanceIds: [],
        }),
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Know Thy Enemy',
          key: 'ktePostSuccess',
          value: true,
        }),
      })
    );
  });

  it('reviewAction lists Hope intel and Stress strip-Fear chips after success', () => {
    const char = mockCharacter({ instanceId: 'kte-3' });
    const adv = mockAdversary({ instanceId: 'adv-3' });
    const gs = mockGameState({
      activeElements: [char, adv],
      fear: 2,
      _ownerInstanceId: 'kte-3',
      _featureKey: 'Know Thy Enemy',
      featureState: {
        'Know Thy Enemy': {
          ktePostSuccess: true,
          kteHopeUsed: false,
          kteStressUsed: false,
          kteTargetId: 'adv-3',
        },
      },
      action: {
        type: 'trait',
        actorInstanceId: 'kte-3',
        trait: 'Instinct',
        targetInstanceIds: [],
        effects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...KnowThyEnemy, _ownerInstanceId: 'kte-3' }], 'reviewAction', tbl);
    const names = chips.map((c) => c.name);
    expect(names).toContain('Know Thy Enemy — ask the GM');
    expect(names).toContain('Know Thy Enemy — remove Fear');
  });

  it('remove Fear chip queues spendFear and marks kteStressUsed', () => {
    const char = mockCharacter({ instanceId: 'kte-4' });
    const adv = mockAdversary({ instanceId: 'adv-4' });
    const gs = mockGameState({
      activeElements: [char, adv],
      fear: 2,
      _ownerInstanceId: 'kte-4',
      _featureKey: 'Know Thy Enemy',
      featureState: {
        'Know Thy Enemy': {
          ktePostSuccess: true,
          kteHopeUsed: false,
          kteStressUsed: false,
          kteTargetId: 'adv-4',
        },
      },
      action: {
        type: 'trait',
        actorInstanceId: 'kte-4',
        trait: 'Instinct',
        targetInstanceIds: [],
        effects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...KnowThyEnemy, _ownerInstanceId: 'kte-4' }], 'reviewAction', tbl);
    const stressChip = chips.find((c) => c.name === 'Know Thy Enemy — remove Fear');
    expect(stressChip).toBeDefined();
    const fromUse = activateChip(stressChip, tbl, makeChipState());
    deductChipCosts(stressChip, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendFear',
        payload: expect.objectContaining({ amount: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Know Thy Enemy',
          key: 'kteStressUsed',
          value: true,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'kte-4', amount: 1 }),
      })
    );
  });
});

describe('Bone Tier 1 — Signature Move', () => {
  it('intent chip is once per rest and sets d20 Hope die + pending flag on use', () => {
    const char = mockCharacter({ instanceId: 'sig-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'sig-1',
      _featureKey: 'Signature Move',
      featureState: { 'Signature Move': {} },
      action: { type: 'attack', actorInstanceId: 'sig-1', targetInstanceIds: [], effects: [] },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...SignatureMove, _ownerInstanceId: 'sig-1' }], 'intent', tbl);
    const sm = chips.find((c) => c.name === 'Signature Move');
    expect(sm).toBeDefined();
    expect(sm.frequency).toBe('rest');
    const fromUse = activateChip(sm, tbl, makeChipState());
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setDie',
        payload: expect.objectContaining({ dieType: 'hopeDie', die: 'd20' }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Signature Move',
          key: 'signatureMovePending',
          value: true,
        }),
      })
    );
  });

  it('onResolve clears 1 Stress when pending and the action roll succeeds', () => {
    const sig = mockCharacter({ instanceId: 'sig-1' });
    const { mutations } = runResolve(
      { ...SignatureMove, _ownerInstanceId: 'sig-1' },
      {
        activeElements: [sig, mockAdversary()],
        featureState: { 'Signature Move': { signatureMovePending: true } },
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: expect.objectContaining({ instanceId: 'sig-1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Signature Move',
          key: 'signatureMovePending',
          value: false,
        }),
      })
    );
  });

  it('onResolve does not clear Stress when the roll fails but clears pending', () => {
    const sig = mockCharacter({ instanceId: 'sig-1' });
    const { mutations } = runResolve(
      { ...SignatureMove, _ownerInstanceId: 'sig-1' },
      {
        activeElements: [sig, mockAdversary()],
        featureState: { 'Signature Move': { signatureMovePending: true } },
        rolls: mockRoll({ isSuccess: false }),
      }
    );
    expect(mutations.filter((m) => m.type === 'clearStress')).toHaveLength(0);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'signatureMovePending',
          value: false,
        }),
      })
    );
  });
});
