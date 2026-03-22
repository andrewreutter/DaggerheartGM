import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { BareBones } from '../../../../src/features-v2/abilities/Valor/BareBones.js';
import { ForcefulPush } from '../../../../src/features-v2/abilities/Valor/ForcefulPush.js';
import { IAmYourShield } from '../../../../src/features-v2/abilities/Valor/IAmYourShield.js';
import { BodyBasher } from '../../../../src/features-v2/abilities/Valor/BodyBasher.js';
import { BoldPresence } from '../../../../src/features-v2/abilities/Valor/BoldPresence.js';
import { CriticalInspiration } from '../../../../src/features-v2/abilities/Valor/CriticalInspiration.js';
import { LeanOnMe } from '../../../../src/features-v2/abilities/Valor/LeanOnMe.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockRoll,
  runReviewAction,
  runIntent,
  runResolve,
} from '../helpers.js';

describe('Valor Tier 1 — Bare Bones', () => {
  it('sets unarmored Armor Score to 3 + Strength and tier 1 thresholds when no armorId', () => {
    const { stats } = applyDeclarativeFeatures(
      [{ ...BareBones, _ownerInstanceId: 'v1' }],
      mockCharacter({
        instanceId: 'v1',
        armorId: null,
        armorScore: 0,
        armorThresholds: { major: 5, severe: 12 },
        traits: { agility: 1, strength: 2, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
        level: 1,
      }),
      {},
      null
    );
    expect(stats.armorScore).toBe(5);
    expect(stats.majorThreshold).toBe(9);
    expect(stats.severeThreshold).toBe(19);
  });

  it('does not modify stats when armor is equipped', () => {
    const { stats } = applyDeclarativeFeatures(
      [{ ...BareBones, _ownerInstanceId: 'v1' }],
      mockCharacter({
        instanceId: 'v1',
        armorId: 'srd-armor-leather',
        armorScore: 2,
        armorThresholds: { major: 7, severe: 14 },
        traits: { agility: 1, strength: 2, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
      }),
      {},
      null
    );
    expect(stats.armorScore).toBe(2);
    expect(stats.majorThreshold).toBe(7);
    expect(stats.severeThreshold).toBe(14);
  });
});

describe('Valor Tier 1 — Forceful Push', () => {
  it('card queues attack actionLoop', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'v1' })],
        _ownerInstanceId: 'v1',
        _featureKey: 'Forceful Push',
        action: { type: 'free', actorInstanceId: 'v1', targetInstanceIds: [], effects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...ForcefulPush, _ownerInstanceId: 'v1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Forceful Push' }),
      })
    );
  });

  it('Hope damage chip adds d6 when attack succeeds and Hope dominates', () => {
    const char = mockCharacter({ instanceId: 'v1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'v1',
        _featureKey: 'Forceful Push',
        action: {
          type: 'attack',
          actorInstanceId: 'v1',
          targetInstanceIds: ['adv-1'],
          effects: [],
        },
        rolls: mockRoll({ hopeValue: 10, fearValue: 3, isSuccess: true }),
      })
    );
    const chips = collectChips([{ ...ForcefulPush, _ownerInstanceId: 'v1' }], 'reviewAction', tbl);
    const hopeChip = chips.find((c) => c.name === 'Forceful Push — Hope damage');
    expect(hopeChip?.name).toBe('Forceful Push — Hope damage');
    const m = activateChip(hopeChip, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({ rollKey: 'damage', die: 'd6', name: 'Forceful Push' }),
      })
    );
  });
});

describe('Valor Tier 1 — I Am Your Shield', () => {
  it('redirects Very Close ally damage to the Valor character', () => {
    const valor = mockCharacter({ instanceId: 'v1', tokenX: 0, tokenY: 0, name: 'Guard' });
    const ally = mockCharacter({ instanceId: 'ally-1', name: 'Ally', tokenX: 8, tokenY: 0, currentHp: 4, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 20, tokenY: 0 });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'ally-1' },
        amount: 2,
        damageType: 'physical',
        source: adv,
      },
    ];

    const { chips } = runReviewAction(
      { ...IAmYourShield, _ownerInstanceId: 'v1' },
      {
        activeElements: [valor, ally, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['ally-1'],
          effects,
        },
        rolls: mockRoll({ isSuccess: true }),
      }
    );

    expect(chips).toHaveLength(1);
    expect(chips[0].stressCost).toBe(1);

    const gs = mockGameState({
      activeElements: [valor, ally, adv],
      _ownerInstanceId: 'v1',
      _featureKey: 'I Am Your Shield',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['ally-1'],
        effects,
      },
      rolls: mockRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const fromUse = activateChip(chips[0], tbl, makeChipState(), { selectedTargetIds: ['ally-1'] });
    deductChipCosts(chips[0], tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];

    expect(effects[0].target.instanceId).toBe('v1');
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'v1', amount: 1 }),
      })
    );
  });
});

describe('Valor Tier 1 — Body Basher', () => {
  it('adds Strength to damage on a successful melee attack', () => {
    const { mutations } = runIntent(
      { ...BodyBasher, _ownerInstanceId: 'v1' },
      {
        activeElements: [
          mockCharacter({
            instanceId: 'v1',
            traits: { strength: 2, agility: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
          }),
          mockAdversary(),
        ],
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Body Basher', value: 2 }),
      })
    );
  });
});

describe('Valor Tier 1 — Bold Presence', () => {
  it('intent chip adds Strength on Presence trait rolls', () => {
    const { chips } = runIntent(
      { ...BoldPresence, _ownerInstanceId: 'v1' },
      {
        activeElements: [mockCharacter({ instanceId: 'v1' }), mockAdversary()],
        actionType: 'trait',
        action: { traitKey: 'Presence' },
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    const bold = chips.find((c) => c.name === 'Bold Presence');
    expect(bold?.hopeCost).toBe(1);
  });

  it('Stand firm card queues rest-gated actionLoop', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'v1' })],
        _ownerInstanceId: 'v1',
        _featureKey: 'Bold Presence',
        action: { type: 'free', actorInstanceId: 'v1', targetInstanceIds: [], effects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...BoldPresence, _ownerInstanceId: 'v1' }], 'card', tbl);
    const stand = chips.find((c) => c.name === 'Bold Presence — Stand firm');
    expect(stand?.frequency).toBe('rest');
    const m = activateChip(stand, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Bold Presence — Stand firm' }),
      })
    );
  });
});

describe('Valor Tier 1 — Critical Inspiration', () => {
  it('queues actionLoop on critical hit and marks used for the rest cycle', () => {
    const fs = { 'Critical Inspiration': {} };
    const { mutations } = runResolve(
      { ...CriticalInspiration, _ownerInstanceId: 'v1' },
      {
        activeElements: [mockCharacter({ instanceId: 'v1' }), mockAdversary()],
        featureState: fs,
        rolls: mockRoll({ isSuccess: true, isCritical: true }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Critical Inspiration' }),
      })
    );
    expect(fs['Critical Inspiration']?.criticalInspirationUsed).toBe(true);
  });

  it('onRest clears the used flag', () => {
    const fs = { 'Critical Inspiration': { criticalInspirationUsed: true } };
    runIntent(
      { ...CriticalInspiration, _ownerInstanceId: 'v1' },
      {
        activeElements: [mockCharacter({ instanceId: 'v1' }), mockAdversary()],
        featureState: fs,
        actionType: 'shortRest',
        action: { type: 'shortRest' },
      }
    );
    expect(fs['Critical Inspiration']?.criticalInspirationUsed).toBe(false);
  });
});

describe('Valor Tier 1 — Lean on Me', () => {
  it('reviewAction chip when an ally fails a roll', () => {
    const { chips } = runReviewAction(
      { ...LeanOnMe, _ownerInstanceId: 'c2' },
      {
        activeElements: [mockCharacter({ instanceId: 'c1' }), mockCharacter({ instanceId: 'c2' })],
        _ownerInstanceId: 'c2',
        action: {
          actorInstanceId: 'c1',
          targetInstanceIds: ['adv-1'],
        },
        rolls: mockRoll({ isSuccess: false }),
      }
    );
    expect(chips).toContainEqual(expect.objectContaining({ name: 'Lean on Me', frequency: 'longRest' }));
  });

  it('hides chip when the ally succeeded', () => {
    const { chips } = runReviewAction(
      { ...LeanOnMe, _ownerInstanceId: 'c2' },
      {
        activeElements: [mockCharacter({ instanceId: 'c1' }), mockCharacter({ instanceId: 'c2' })],
        _ownerInstanceId: 'c2',
        action: {
          actorInstanceId: 'c1',
          targetInstanceIds: ['adv-1'],
        },
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    expect(chips.filter((c) => c.name === 'Lean on Me')).toHaveLength(0);
  });
});
