/**
 * Unit tests for src/client/lib/battle-points.js
 *
 * These are pure-logic tests that run in Node via Vitest.
 * No browser, no DOM, no Firebase needed.
 */
import { describe, it, expect } from 'vitest';
import {
  computeBudget,
  computeBattlePoints,
  computeAutoModifiers,
  computeTotalBudgetMod,
  applyDamageBoost,
  collectSceneAdversaries,
  computeSceneBudget,
} from '../../src/client/lib/battle-points.js';

// ---------------------------------------------------------------------------
// computeBudget
// ---------------------------------------------------------------------------
describe('computeBudget', () => {
  it('returns 3×partySize + 2 for any party size', () => {
    expect(computeBudget(4)).toBe(14);
    expect(computeBudget(1)).toBe(5);
    expect(computeBudget(6)).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// computeBattlePoints
// ---------------------------------------------------------------------------
describe('computeBattlePoints', () => {
  it('sums BP costs for a mixed group of adversaries', () => {
    // bruiser=4, standard=2, minion costs 1 per group of partySize
    const adversaries = [
      { role: 'bruiser', tier: 1, count: 1 },
      { role: 'standard', tier: 1, count: 2 },
    ];
    // bruiser: 1×4 = 4, standard: 2×2 = 4  → total 8
    expect(computeBattlePoints(adversaries, 4)).toBe(8);
  });

  it('counts minions as 1 BP per group equal to party size', () => {
    // 4 minions for a party of 4 = 1 group = 1 BP
    const adversaries = [{ role: 'minion', tier: 1, count: 4 }];
    expect(computeBattlePoints(adversaries, 4)).toBe(1);
  });

  it('rounds minion groups up', () => {
    // 5 minions for a party of 4 = ceil(5/4) = 2 groups = 2 BP
    const adversaries = [{ role: 'minion', tier: 1, count: 5 }];
    expect(computeBattlePoints(adversaries, 4)).toBe(2);
  });

  it('returns 0 for an empty adversary list', () => {
    expect(computeBattlePoints([], 4)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeAutoModifiers
// ---------------------------------------------------------------------------
// Each modifier is an object: { active: boolean, value: number, label: string }
describe('computeAutoModifiers', () => {
  it('detects no-heavy-roles modifier when only standard adversaries', () => {
    const adversaries = [{ role: 'standard', tier: 1, count: 2 }];
    const mods = computeAutoModifiers(adversaries, 1);
    expect(mods.noHeavyRoles.active).toBe(true);
    expect(mods.noHeavyRoles.value).toBe(1);
  });

  it('detects 2+ Solos modifier (key is twoOrMoreSolos)', () => {
    const adversaries = [
      { role: 'solo', tier: 1, count: 1 },
      { role: 'solo', tier: 1, count: 1 },
    ];
    const mods = computeAutoModifiers(adversaries, 1);
    expect(mods.twoOrMoreSolos.active).toBe(true);
    expect(mods.twoOrMoreSolos.value).toBe(-2);
  });

  it('does not flag twoOrMoreSolos for a single Solo', () => {
    const adversaries = [{ role: 'solo', tier: 1, count: 1 }];
    const mods = computeAutoModifiers(adversaries, 1);
    expect(mods.twoOrMoreSolos.active).toBe(false);
  });

  it('detects lower-tier adversary when adversary tier is below partyTier', () => {
    const adversaries = [{ role: 'standard', tier: 1, count: 1 }];
    const mods = computeAutoModifiers(adversaries, 2); // partyTier=2, adversary tier=1
    expect(mods.lowerTierAdversary.active).toBe(true);
    expect(mods.lowerTierAdversary.value).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeTotalBudgetMod
// ---------------------------------------------------------------------------
describe('computeTotalBudgetMod', () => {
  it('sums auto and user modifier values', () => {
    // twoOrMoreSolos=-2, noHeavyRoles=+1, moreDangerous=+2 → +1
    const autoMods = {
      twoOrMoreSolos: { active: true, value: -2 },
      lowerTierAdversary: { active: false, value: 1 },
      noHeavyRoles: { active: true, value: 1 },
    };
    const userMods = { lessDifficult: false, damageBoostD4: false, damageBoostStatic: false, moreDangerous: true };
    const total = computeTotalBudgetMod(autoMods, userMods);
    expect(total).toBe(1);
  });

  it('returns 0 when no modifiers active', () => {
    const autoMods = { multiSolo: false, lowerTierAdversary: false, noHeavyRoles: false };
    const userMods = { lessDifficult: false, damageBoostD4: false, damageBoostStatic: false, moreDangerous: false };
    expect(computeTotalBudgetMod(autoMods, userMods)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyDamageBoost
// ---------------------------------------------------------------------------
describe('applyDamageBoost', () => {
  it('appends +1d4 for d4 boost', () => {
    expect(applyDamageBoost('2d6+3', 'd4')).toBe('2d6+3+1d4');
  });

  it('appends +2 for static boost', () => {
    expect(applyDamageBoost('1d8', 'static')).toBe('1d8+2');
  });

  it('appends +2 for any unrecognized boostType (fallback in implementation)', () => {
    // The implementation has no guard for unknown boostType; it falls through to '+2'.
    // This test documents that behavior so regressions are caught if the fallback changes.
    expect(applyDamageBoost('1d6', null)).toBe('1d6+2');
  });
});

// ---------------------------------------------------------------------------
// collectSceneAdversaries
// ---------------------------------------------------------------------------
describe('collectSceneAdversaries', () => {
  it('returns empty array for a scene with no adversaries', () => {
    const scene = { id: 's1', adversaries: [] };
    expect(collectSceneAdversaries(scene, {})).toEqual([]);
  });

  it('collects adversaries referenced by ID', () => {
    const scene = {
      id: 's1',
      adversaries: [{ adversaryId: 'a1', count: 2 }],
    };
    const data = {
      adversaries: [{ id: 'a1', name: 'Goblin', role: 'minion', tier: 1 }],
      scenes: [],
    };
    const result = collectSceneAdversaries(scene, data);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ role: 'minion', tier: 1, count: 2, name: 'Goblin' });
  });

  it('collects inline (owned-copy) adversaries', () => {
    const scene = {
      id: 's1',
      adversaries: [{ data: { name: 'Orc', role: 'bruiser', tier: 2 }, count: 1 }],
    };
    const result = collectSceneAdversaries(scene, {});
    expect(result[0]).toMatchObject({ role: 'bruiser', tier: 2, count: 1, name: 'Orc' });
  });

  it('prevents infinite loops from circular scene references', () => {
    // scene A references scene B which references scene A
    const sceneA = { id: 'A', adversaries: [], scenes: ['B'] };
    const sceneB = { id: 'B', adversaries: [], scenes: ['A'] };
    const data = { adversaries: [], scenes: [sceneA, sceneB] };
    // Should not throw or hang
    expect(() => collectSceneAdversaries(sceneA, data)).not.toThrow();
  });
});
