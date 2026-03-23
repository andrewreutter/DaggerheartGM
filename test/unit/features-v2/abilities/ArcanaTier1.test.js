import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import { RuneWard } from '../../../../src/features-v2/abilities/Arcana/RuneWard.js';
import { UnleashChaos } from '../../../../src/features-v2/abilities/Arcana/UnleashChaos.js';
import { WallWalk } from '../../../../src/features-v2/abilities/Arcana/WallWalk.js';
import { CinderGrasp } from '../../../../src/features-v2/abilities/Arcana/CinderGrasp.js';
import { FloatingEye } from '../../../../src/features-v2/abilities/Arcana/FloatingEye.js';
import { Counterspell } from '../../../../src/features-v2/abilities/Arcana/Counterspell.js';
import { Flight } from '../../../../src/features-v2/abilities/Arcana/Flight.js';

import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockAdversaryAttackRoll,
  mockRoll,
  runReviewAction,
  runResolve,
  runIntent,
  mockAction,
} from '../helpers.js';

describe('Arcana Tier 1 — Rune Ward', () => {
  it('reviewAction chip spends Hope and reduces pending damage by d8 (happy path)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'char-1' },
        amount: 10,
        damageType: 'physical',
      },
    ];

    const { chips } = runReviewAction(
      { ...RuneWard, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _rng: () => 0.25,
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Agility',
          range: 'melee',
          effects,
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      }
    );

    expect(chips.length).toBeGreaterThanOrEqual(1);
    const chip = chips.find((c) => c.name === 'Rune Ward') ?? chips[0];
    expect(chip.hopeCost).toBe(1);

    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Rune Ward',
      _rng: () => 0.25,
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        trait: 'Agility',
        range: 'melee',
        effects,
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const fromUse = activateChip(chip, tbl, makeChipState());
    deductChipCosts(chip, tbl);
    const fromCost = applyMutations(tbl);
    const mutations = [...fromUse, ...fromCost];

    expect(effects[0].amount).toBe(7);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd8', total: 3 }),
      })
    );
  });

  it('does not offer the ward chip when runeWardDepleted is set', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewAction(
      { ...RuneWard, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        featureState: { 'Rune Ward': { runeWardDepleted: true } },
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Agility',
          range: 'melee',
          effects: [
            {
              type: 'damage',
              target: { instanceId: 'char-1' },
              amount: 5,
              damageType: 'magic',
            },
          ],
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      }
    );
    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });

  it('does not offer the ward chip when the character is not targeted', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const ally = mockCharacter({ instanceId: 'ally-1' });
    const { chips } = runReviewAction(
      { ...RuneWard, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv, ally],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['ally-1'],
          trait: 'Agility',
          range: 'melee',
          effects: [
            {
              type: 'damage',
              target: { instanceId: 'ally-1' },
              amount: 3,
              damageType: 'physical',
            },
          ],
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      }
    );
    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });

  it('onRest clears runeWardDepleted', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'c1',
      _featureKey: 'Rune Ward',
      featureState: { 'Rune Ward': { runeWardDepleted: true } },
      action: {
        type: 'longRest',
        actorInstanceId: 'c1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    RuneWard.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Rune Ward',
          key: 'runeWardDepleted',
          value: false,
        }),
      })
    );
  });

  it('Ward Holder card stores runeWardHolderInstanceId on the caster', () => {
    const wiz = mockCharacter({ instanceId: 'w1' });
    const ally = mockCharacter({ instanceId: 'a1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [wiz, ally],
        _ownerInstanceId: 'w1',
        _featureKey: 'Rune Ward',
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
    const chips = collectChips([{ ...RuneWard, _ownerInstanceId: 'w1' }], 'card', tbl);
    const holder = chips.find((c) => c.name === 'Ward Holder');
    expect(holder).toBeDefined();
    const m = activateChip(holder, tbl, makeChipState(), { selectedTargetIds: ['a1'] });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Rune Ward',
          key: 'runeWardHolderInstanceId',
          value: 'a1',
        }),
      })
    );
  });
});

describe('Arcana Tier 1 — Unleash Chaos', () => {
  it('onSessionStart sets tokens from Spellcast trait', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      spellcastTrait: 'presence',
      traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 3, knowledge: 0 },
    });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char], featureState: {} }),
      mockAction({ type: 'sessionStart', actorInstanceId: 'char-1' }),
      [{ ...UnleashChaos, _ownerInstanceId: 'char-1' }]
    );
    const { mutations } = loop.runPhase('resolve');
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Unleash Chaos',
          key: 'unleashChaosTokens',
          value: 3,
        }),
      })
    );
  });

  it('Cast chip spends tokens and queues actionLoop with trait label', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      spellcastTrait: 'knowledge',
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 2 },
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Unleash Chaos',
        featureState: { 'Unleash Chaos': { unleashChaosTokens: 2 } },
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
    const annotated = { ...UnleashChaos, _ownerInstanceId: 'char-1' };
    const chips = collectChips([annotated], 'card', tbl);
    const cast = chips.find((c) => c.name === 'Unleash Chaos');
    expect(cast).toBeDefined();
    const mutations = activateChip(cast, tbl, makeChipState(), { selectedId: '2' });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Unleash Chaos',
          trait: 'Knowledge',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Unleash Chaos',
          key: 'unleashChaosTokens',
          value: 0,
        }),
      })
    );
  });
});

describe('Arcana Tier 1 — Wall Walk / Floating Eye / Cinder Grasp', () => {
  it('Wall Walk Hope card sets wallWalkActive and actionLoop', () => {
    const char = mockCharacter({ instanceId: 'w1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'w1',
        _featureKey: 'Wall Walk',
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
    const chips = collectChips([{ ...WallWalk, _ownerInstanceId: 'w1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ featureKey: 'Wall Walk', key: 'wallWalkActive', value: true }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Wall Walk' }),
      })
    );
  });

  it('Floating Eye Hope card sets floatingEyeActive and actionLoop', () => {
    const char = mockCharacter({ instanceId: 'f1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'f1',
        _featureKey: 'Floating Eye',
        action: {
          type: 'free',
          actorInstanceId: 'f1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...FloatingEye, _ownerInstanceId: 'f1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Floating Eye',
          key: 'floatingEyeActive',
          value: true,
        }),
      })
    );
    expect(m.some((x) => x.type === 'actionLoop' && x.payload?.title === 'Floating Eye')).toBe(true);
  });

  it('Cinder Grasp card queues Spellcast actionLoop', () => {
    const char = mockCharacter({ instanceId: 'c1', spellcastTrait: 'instinct' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'c1',
        _featureKey: 'Cinder Grasp',
        action: {
          type: 'free',
          actorInstanceId: 'c1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...CinderGrasp, _ownerInstanceId: 'c1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Cinder Grasp',
          trait: 'Instinct',
        }),
      })
    );
  });

  it('onResolve queues 2d6 magic addDamageRoll when action actor has On Fire', () => {
    const caster = mockCharacter({ instanceId: 'c1' });
    const burning = mockAdversary({ instanceId: 'adv-1', conditions: ['On Fire'] });

    const { mutations } = runResolve({ ...CinderGrasp, _ownerInstanceId: 'c1' }, {
      activeElements: [caster, burning],
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['c1'],
      },
      rolls: mockRoll(),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addDamageRoll',
        payload: expect.objectContaining({
          name: 'Cinder Grasp (On Fire)',
          dice: '2d6',
          damageType: 'magic',
          targetInstanceIds: ['adv-1'],
          sourceInstanceId: 'c1',
        }),
      })
    );
  });

  it('onResolve does not queue On Fire tick when action actor lacks On Fire', () => {
    const caster = mockCharacter({ instanceId: 'c1' });
    const notBurning = mockAdversary({ instanceId: 'adv-1', conditions: [] });

    const { mutations } = runResolve({ ...CinderGrasp, _ownerInstanceId: 'c1' }, {
      activeElements: [caster, notBurning],
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['c1'],
      },
      rolls: mockRoll(),
    });

    expect(mutations.filter((m) => m.type === 'addDamageRoll')).toHaveLength(0);
  });
});

describe('Arcana Tier 1 — Counterspell', () => {
  it('reviewAction chip moves Counterspell to vault on a successful reaction roll', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Counterspell',
        action: {
          type: 'reaction',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          trait: 'Spellcast',
          effects: [],
          appliedEffects: [],
        },
        rolls: mockRoll({ isSuccess: true }),
      })
    );
    const chips = collectChips([{ ...Counterspell, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    expect(chips).toHaveLength(1);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'domainCardMoveToVault',
        payload: expect.objectContaining({ cardId: 'srd-abl-counterspell', instanceId: 'char-1' }),
      })
    );
  });

  it('does not expose the vault chip when the reaction roll failed', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Counterspell',
        action: {
          type: 'reaction',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          trait: 'Spellcast',
          effects: [],
          appliedEffects: [],
        },
        rolls: mockRoll({ isSuccess: false }),
      })
    );
    const chips = collectChips([{ ...Counterspell, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    expect(chips).toHaveLength(0);
  });

  it('does not expose the vault chip when another actor had a successful reaction roll', () => {
    const char1 = mockCharacter({ instanceId: 'char-1' });
    const char2 = mockCharacter({ instanceId: 'char-2', name: 'Other PC' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char1, char2],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Counterspell',
        action: {
          type: 'reaction',
          actorInstanceId: 'char-2',
          targetInstanceIds: [],
          trait: 'Spellcast',
          effects: [],
          appliedEffects: [],
        },
        rolls: mockRoll({ isSuccess: true }),
      })
    );
    const chips = collectChips([{ ...Counterspell, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    expect(chips).toHaveLength(0);
  });
});

describe('Arcana Tier 1 — Flight', () => {
  it('card onUse sets tokens from Agility and arms flight', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      traits: { agility: 2, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Flight',
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
    const chips = collectChips([{ ...Flight, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Flight',
          key: 'flightTokens',
          value: 2,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Flight',
          key: 'flightActive',
          value: true,
        }),
      })
    );
  });

  it('onIntent spends one flight token per Hope/Fear action roll while active', () => {
    const { mutations } = runIntent(
      { ...Flight, _ownerInstanceId: 'char-1' },
      {
        actionType: 'trait',
        featureState: { Flight: { flightTokens: 2, flightActive: true } },
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Flight',
          key: 'flightTokens',
          value: 1,
        }),
      })
    );
  });

  it('onIntent clears flight and narrates when the last token is spent', () => {
    const { mutations, narrations } = runIntent(
      { ...Flight, _ownerInstanceId: 'char-1' },
      {
        actionType: 'trait',
        featureState: { Flight: { flightTokens: 1, flightActive: true } },
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Flight',
          key: 'flightActive',
          value: false,
        }),
      })
    );
    expect(narrations.some((n) => String(n).includes('descend'))).toBe(true);
  });
});
