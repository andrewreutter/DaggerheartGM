import { describe, it, expect } from 'vitest';
import {
  WingsOfLight,
  EtherealVisage,
  Ascendant,
  PowerOfTheGods,
} from '../../../../src/features-v2/subclasses/WingedSentinel.js';
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
  mockCharacter,
  mockAdversary,
  mockAction,
  mockGameState,
  mockRoll,
  runIntent,
  runReviewAction,
  runReviewOutcome,
} from '../helpers.js';

const WS_ROW = { sourceScopeKey: 'WingedSentinel' };

describe('Winged Sentinel — Ascendant', () => {
  it('adds +4 Severe threshold', () => {
    const c = mockCharacter({ armorThresholds: { major: 2, severe: 6 } });
    const { stats } = applyDeclarativeFeatures(
      [{ ...Ascendant, _ownerInstanceId: c.instanceId }],
      c,
      { featureState: {} }
    );
    expect(stats.severeThreshold).toBe(10);
  });
});

describe('Winged Sentinel — Wings of Light', () => {
  it('exposes fly movement mode only while flying', () => {
    const c = mockCharacter({ instanceId: 'ws-1' });
    const off = applyDeclarativeFeatures(
      [{ ...WingsOfLight, _ownerInstanceId: 'ws-1' }],
      c,
      { featureState: {} }
    );
    expect(off.movementModes).not.toContain('fly');

    const on = applyDeclarativeFeatures(
      [{ ...WingsOfLight, _ownerInstanceId: 'ws-1' }],
      c,
      { featureState: { WingedSentinel: { flying: true } } }
    );
    expect(on.movementModes).toContain('fly');
  });

  it('reviewAction chip adds d8 extra damage when flying, successful attack, and Hope is paid', () => {
    const c = mockCharacter({ instanceId: 'ws-1', hope: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      _ownerInstanceId: 'ws-1',
      _featureKey: 'Wings of Light',
      featureState: { WingedSentinel: { flying: true } },
      fear: 0,
      rolls: mockRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'ws-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Strength',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    gs.rolls.damage = { dice: [], statics: [] };

    const tbl = buildTableSnapshot({
      ...gs,
      _activeFeature: { ...WingsOfLight, _sourceScopeKey: 'WingedSentinel', _sourceObject: WS_ROW },
    });
    const chips = collectChips(
      [{ ...WingsOfLight, _ownerInstanceId: 'ws-1', _sourceObject: WS_ROW }],
      'reviewAction',
      tbl
    );
    const dmgChip = chips.find((ch) => ch.description?.includes('extra'));
    expect(dmgChip).toBeDefined();
    const fromUse = activateChip(dmgChip, tbl, makeChipState());
    deductChipCosts(dmgChip, tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Wings of Light', die: 'd8' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'ws-1', amount: 1 }),
      })
    );
  });

  it('does not offer extra damage chip while not flying', () => {
    const c = mockCharacter({ instanceId: 'ws-1', hope: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      _ownerInstanceId: 'ws-1',
      featureState: {},
      rolls: mockRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'ws-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Strength',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    gs.rolls.damage = { dice: [], statics: [] };
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips(
      [{ ...WingsOfLight, _ownerInstanceId: 'ws-1', _sourceObject: WS_ROW }],
      'reviewAction',
      tbl
    );
    expect(chips.filter((ch) => ch.description?.includes('extra'))).toHaveLength(0);
  });
});

describe('Winged Sentinel — Power of the Gods', () => {
  it('onSessionStart flags mastery so Wings of Light uses d12', () => {
    const c = mockCharacter({ instanceId: 'ws-1', hope: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [c, adv], featureState: {} }),
      mockAction({ type: 'sessionStart', actorInstanceId: 'ws-1', targetInstanceIds: [] }),
      [{ ...PowerOfTheGods, _ownerInstanceId: 'ws-1', _sourceObject: WS_ROW }]
    );
    const { mutations } = loop.runPhase('intent');
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'WingedSentinel',
          key: 'powerOfTheGodsMastery',
          value: true,
        }),
      })
    );
  });
});

describe('Winged Sentinel — Wings of Light + Power of the Gods', () => {
  it('reviewAction extra damage uses d12 when mastery flag is set', () => {
    const c = mockCharacter({ instanceId: 'ws-1', hope: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      _ownerInstanceId: 'ws-1',
      _featureKey: 'Wings of Light',
      _sourceObject: WS_ROW,
      featureState: { WingedSentinel: { flying: true, powerOfTheGodsMastery: true } },
      rolls: mockRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'ws-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Strength',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    gs.rolls.damage = { dice: [], statics: [] };

    const tbl = buildTableSnapshot(gs);
    const chips = collectChips(
      [{ ...WingsOfLight, _ownerInstanceId: 'ws-1', _sourceObject: WS_ROW }],
      'reviewAction',
      tbl
    );
    const dmgChip = chips.find((ch) => ch.description?.includes('extra'));
    const fromUse = activateChip(dmgChip, tbl, makeChipState());
    deductChipCosts(dmgChip, tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Wings of Light', die: 'd12' }),
      })
    );
  });
});

describe('Winged Sentinel — Ethereal Visage', () => {
  it('onIntent adds advantage on Presence while flying', () => {
    const c = mockCharacter({ instanceId: 'ws-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(
      { ...EtherealVisage, _ownerInstanceId: 'ws-1', _sourceObject: WS_ROW },
      {
        activeElements: [c, adv],
        featureState: { WingedSentinel: { flying: true } },
        action: mockAction({ type: 'trait', traitKey: 'Presence', actorInstanceId: 'ws-1' }),
        rolls: mockRoll(),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addAdvantageDie',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Ethereal Visage' }),
      })
    );
  });

  it('does not add advantage when not flying', () => {
    const c = mockCharacter({ instanceId: 'ws-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(
      { ...EtherealVisage, _ownerInstanceId: 'ws-1', _sourceObject: WS_ROW },
      {
        activeElements: [c, adv],
        featureState: {},
        action: mockAction({ type: 'trait', traitKey: 'Presence', actorInstanceId: 'ws-1' }),
        rolls: mockRoll(),
      }
    );
    expect(mutations.filter((m) => m.type === 'addAdvantageDie')).toHaveLength(0);
  });

  it('reviewOutcome chip can spend GM Fear instead of Hope gain when Hope dominates', () => {
    const c = mockCharacter({ instanceId: 'ws-1' });
    const gs = mockGameState({
      activeElements: [c, mockAdversary()],
      _ownerInstanceId: 'ws-1',
      featureState: { WingedSentinel: { flying: true } },
      fear: 2,
      rolls: mockRoll({ hopeValue: 10, fearValue: 4, isSuccess: true }),
      action: {
        type: 'trait',
        actorInstanceId: 'ws-1',
        targetInstanceIds: [],
        trait: 'Presence',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });

    const tbl = buildTableSnapshot(gs);
    const chips = collectChips(
      [{ ...EtherealVisage, _ownerInstanceId: 'ws-1', _sourceObject: WS_ROW }],
      'reviewOutcome',
      tbl
    );
    const fearChip = chips.find((ch) => ch.name?.includes('Fear'));
    expect(fearChip).toBeDefined();
    const fromUse = activateChip(fearChip, tbl, makeChipState({ _isOn: true }));
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendFear',
        payload: { amount: 1 },
      })
    );
  });

  it('reviewOutcome chip is disabled when GM Fear pool is empty', () => {
    const c = mockCharacter({ instanceId: 'ws-1' });
    const gs = mockGameState({
      activeElements: [c, mockAdversary()],
      _ownerInstanceId: 'ws-1',
      featureState: { WingedSentinel: { flying: true } },
      fear: 0,
      rolls: mockRoll({ hopeValue: 10, fearValue: 4, isSuccess: true }),
      action: {
        type: 'trait',
        actorInstanceId: 'ws-1',
        targetInstanceIds: [],
        trait: 'Presence',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips(
      [{ ...EtherealVisage, _ownerInstanceId: 'ws-1', _sourceObject: WS_ROW }],
      'reviewOutcome',
      tbl
    );
    const fearChip = chips.find((ch) => ch.name?.includes('Fear'));
    expect(fearChip.isDisabled(tbl)).toBe(true);
  });
});
