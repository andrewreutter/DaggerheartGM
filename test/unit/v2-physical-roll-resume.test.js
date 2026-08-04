/**
 * Tests for src/client/lib/v2-physical-roll-resume.js
 *
 * Covers:
 * - Returns null for rolls without _v2PhysicalRollResume
 * - Bails gracefully when the character or feature is gone
 * - Resolves feature via the registry (loadCharacterFeatures + applyDeclarativeFeatures),
 *   not a pre-computed `activeFeatures` array (raw `activeElements` never carry one)
 * - Sets table.me to meInstanceId
 * - Parses rollResult from banner sub-items correctly (with and without details)
 */

import { describe, it, expect } from 'vitest';
import { runV2PhysicalRollResolvedPhase } from '../../src/client/lib/v2-physical-roll-resume.js';

// ---------------------------------------------------------------------------
// Minimal stubs
// ---------------------------------------------------------------------------

function makeCharEl(overrides = {}) {
  return {
    elementType: 'character',
    instanceId: overrides.instanceId ?? 'c1',
    name: overrides.name ?? 'Hero',
    currentStress: overrides.currentStress ?? 0,
    maxStress: overrides.maxStress ?? 6,
    currentHp: overrides.currentHp ?? 6,
    maxHp: overrides.maxHp ?? 6,
    hope: overrides.hope ?? 6,
    maxHope: overrides.maxHope ?? 6,
    currentArmor: overrides.currentArmor ?? 2,
    maxArmor: overrides.maxArmor ?? 2,
    level: overrides.level ?? 1,
    traits: overrides.traits ?? { agility: 1, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    featureState: overrides.featureState ?? {},
    classId: overrides.classId ?? 'test-class',
    ...overrides,
  };
}

/**
 * A minimal registry that resolves `character.classId === 'test-class'` to the given
 * feature rows — mirrors how `loadCharacterFeatures` reads `registry.classes[id].features`.
 */
function makeRegistry(features) {
  return { classes: { 'test-class': { features } } };
}

/**
 * Build a minimal roll object as if it came from the banners subscription.
 */
function makeBannerRoll(overrides = {}) {
  return {
    total: overrides.total ?? 5,
    subItems: overrides.subItems ?? [],
    _v2PhysicalRollResume: overrides._v2PhysicalRollResume ?? null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: bail-out paths
// ---------------------------------------------------------------------------

describe('runV2PhysicalRollResolvedPhase — bail-outs', () => {
  it('returns null when roll has no _v2PhysicalRollResume', () => {
    const roll = makeBannerRoll({ _v2PhysicalRollResume: null });
    const result = runV2PhysicalRollResolvedPhase(roll, { activeElements: [], v2Registry: {} });
    expect(result).toBeNull();
  });

  it('returns null when _v2PhysicalRollResume is missing featureName', () => {
    const roll = makeBannerRoll({
      _v2PhysicalRollResume: { featureName: null, featureSourceInstanceId: 'c1', meInstanceId: 'c1', resumeState: null },
    });
    expect(runV2PhysicalRollResolvedPhase(roll, { activeElements: [], v2Registry: {} })).toBeNull();
  });

  it('returns null when featureSourceInstanceId is missing', () => {
    const roll = makeBannerRoll({
      _v2PhysicalRollResume: { featureName: 'TestFeat', featureSourceInstanceId: null, meInstanceId: 'c1', resumeState: null },
    });
    expect(runV2PhysicalRollResolvedPhase(roll, { activeElements: [], v2Registry: {} })).toBeNull();
  });

  it('returns null when v2Registry is missing from ctx', () => {
    const roll = makeBannerRoll({
      _v2PhysicalRollResume: { featureName: 'TestFeat', featureSourceInstanceId: 'c1', meInstanceId: 'c1', resumeState: null },
    });
    expect(runV2PhysicalRollResolvedPhase(roll, { activeElements: [] })).toBeNull();
  });

  it('returns null when the source character element is not found', () => {
    const roll = makeBannerRoll({
      _v2PhysicalRollResume: { featureName: 'TestFeat', featureSourceInstanceId: 'missing', meInstanceId: 'missing', resumeState: null },
    });
    expect(runV2PhysicalRollResolvedPhase(roll, { activeElements: [], v2Registry: {} })).toBeNull();
  });

  it('returns null when the feature is not found via the registry', () => {
    const sourceEl = makeCharEl({ instanceId: 'c1' });
    const registry = makeRegistry([]); // no features registered for this class
    const roll = makeBannerRoll({
      _v2PhysicalRollResume: { featureName: 'GoneFeature', featureSourceInstanceId: 'c1', meInstanceId: 'c1', resumeState: null },
    });
    expect(runV2PhysicalRollResolvedPhase(roll, { activeElements: [sourceEl], v2Registry: registry })).toBeNull();
  });

  it('returns null when feature has no onPhysicalRollResolved hook', () => {
    const feat = { name: 'NoHook', hooks: {} };
    const sourceEl = makeCharEl({ instanceId: 'c1' });
    const registry = makeRegistry([feat]);
    const roll = makeBannerRoll({
      _v2PhysicalRollResume: { featureName: 'NoHook', featureSourceInstanceId: 'c1', meInstanceId: 'c1', resumeState: null },
    });
    expect(runV2PhysicalRollResolvedPhase(roll, { activeElements: [sourceEl], v2Registry: registry })).toBeNull();
  });

  it('returns null when the viewer (meInstanceId) element is not found', () => {
    const feat = { name: 'Feat', hooks: { onPhysicalRollResolved: () => {} } };
    const sourceEl = makeCharEl({ instanceId: 'c1' });
    const registry = makeRegistry([feat]);
    const roll = makeBannerRoll({
      _v2PhysicalRollResume: { featureName: 'Feat', featureSourceInstanceId: 'c1', meInstanceId: 'missingViewer', resumeState: null },
    });
    expect(runV2PhysicalRollResolvedPhase(roll, { activeElements: [sourceEl], v2Registry: registry })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: successful resolve
// ---------------------------------------------------------------------------

describe('runV2PhysicalRollResolvedPhase — successful resolve', () => {
  it('invokes onPhysicalRollResolved with correct rollResult (from subItems)', () => {
    const calls = [];
    const feat = {
      name: 'PrayerDice',
      hooks: {
        onPhysicalRollResolved(table, rollResult, resumeState) {
          calls.push({ tableMe: table.me?.instanceId, rollResult, resumeState });
        },
      },
    };
    const seraph = makeCharEl({ instanceId: 'c1' });
    const registry = makeRegistry([feat]);
    const roll = makeBannerRoll({
      total: 7,
      subItems: [
        { result: '3', details: '(3)', input: '2d4', _preset: false, pre: '' },
        { result: '4', details: '(4)', input: '', _preset: false, pre: '' },
      ],
      _v2PhysicalRollResume: { featureName: 'PrayerDice', featureSourceInstanceId: 'c1', meInstanceId: 'c1', resumeState: { diceCount: 2 } },
    });
    runV2PhysicalRollResolvedPhase(roll, { activeElements: [seraph], v2Registry: registry });
    expect(calls.length).toBe(1);
    expect(calls[0].tableMe).toBe('c1');
    expect(calls[0].rollResult.total).toBe(7);
    expect(calls[0].resumeState).toEqual({ diceCount: 2 });
  });

  it('sets table.me to meInstanceId (viewer), not featureSourceInstanceId (owner) in cross-sheet', () => {
    const calls = [];
    const bardFeat = {
      name: 'Rally',
      hooks: {
        onPhysicalRollResolved(table, rollResult, resumeState) {
          calls.push({ tableMe: table.me?.instanceId });
        },
      },
    };
    const bard = makeCharEl({ instanceId: 'bard', classId: 'test-class' });
    const ally = makeCharEl({ instanceId: 'ally', classId: 'no-features-class' });
    const registry = makeRegistry([bardFeat]);

    const roll = makeBannerRoll({
      total: 5,
      _v2PhysicalRollResume: { featureName: 'Rally', featureSourceInstanceId: 'bard', meInstanceId: 'ally', resumeState: { spenderInstanceId: 'ally' } },
    });
    runV2PhysicalRollResolvedPhase(roll, { activeElements: [bard, ally], v2Registry: registry });
    expect(calls.length).toBe(1);
    // table.me should be the ally (viewer), not the Bard (feature owner).
    expect(calls[0].tableMe).toBe('ally');
  });

  it('returns empty arrays when the hook produces no mutations', () => {
    const feat = {
      name: 'Silent',
      hooks: { onPhysicalRollResolved: () => {} },
    };
    const ch = makeCharEl({ instanceId: 'c1' });
    const registry = makeRegistry([feat]);
    const roll = makeBannerRoll({
      _v2PhysicalRollResume: { featureName: 'Silent', featureSourceInstanceId: 'c1', meInstanceId: 'c1', resumeState: null },
    });
    const result = runV2PhysicalRollResolvedPhase(roll, { activeElements: [ch], v2Registry: registry });
    expect(result).not.toBeNull();
    expect(result.updates).toEqual([]);
    expect(result.actionLoopNotifications).toEqual([]);
    expect(result.sheetActionRolls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: rollResult parsing
// ---------------------------------------------------------------------------

describe('runV2PhysicalRollResolvedPhase — rollResult parsing', () => {
  it('falls back to roll.total when no subItems are present', () => {
    const calls = [];
    const feat = {
      name: 'TestFeat',
      hooks: { onPhysicalRollResolved(_table, rollResult) { calls.push(rollResult); } },
    };
    const ch = makeCharEl({ instanceId: 'c1' });
    const registry = makeRegistry([feat]);
    const roll = makeBannerRoll({
      total: 4,
      subItems: [],
      _v2PhysicalRollResume: { featureName: 'TestFeat', featureSourceInstanceId: 'c1', meInstanceId: 'c1', resumeState: null },
    });
    runV2PhysicalRollResolvedPhase(roll, { activeElements: [ch], v2Registry: registry });
    expect(calls[0].total).toBe(4);
    expect(calls[0].values).toEqual([]);
  });

  it('skips preset (carry-over) sub-items', () => {
    const calls = [];
    const feat = {
      name: 'TestFeat',
      hooks: { onPhysicalRollResolved(_t, r) { calls.push(r); } },
    };
    const ch = makeCharEl({ instanceId: 'c1' });
    const registry = makeRegistry([feat]);
    const roll = makeBannerRoll({
      total: 6,
      subItems: [
        { result: '5', details: '(5)', input: 'd6', _preset: false, pre: '' },
        { result: '3', details: '(3)', input: 'd6', _preset: true, pre: '' },  // preset — skip
      ],
      _v2PhysicalRollResume: { featureName: 'TestFeat', featureSourceInstanceId: 'c1', meInstanceId: 'c1', resumeState: null },
    });
    runV2PhysicalRollResolvedPhase(roll, { activeElements: [ch], v2Registry: registry });
    // Only the non-preset sub-item's result should contribute.
    expect(calls[0].total).toBe(5);
  });
});
