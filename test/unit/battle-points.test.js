/**
 * Unit tests for src/client/lib/battle-points.js
 *
 * These are pure-logic tests that run in Node via Vitest.
 * No browser, no DOM, no Firebase needed.
 *
 * Scene adversaries are full inline `activeElements` rows (`elementType: 'adversary'`).
 */
import { describe, it, expect } from 'vitest';
import {
  computeBudget,
  computeBattlePoints,
  computeAutoModifiers,
  computeTotalBudgetMod,
  applyDamageBoost,
  collectSceneAdversaries,
  computeSceneTier,
  computeSceneBudget,
} from '../../src/client/lib/battle-points.js';

function adv(overrides = {}) {
  return {
    instanceId: overrides.instanceId || 'i-1',
    elementType: 'adversary',
    role: 'standard',
    tier: 1,
    name: 'Goblin',
    ...overrides,
  };
}

function sceneWithAdversaries(adversaries, extra = {}) {
  return { id: 's1', activeElements: adversaries, ...extra };
}

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

  it('applies damageBoostPlusOne (−1) and slightlyMoreDangerous (+1)', () => {
    const autoMods = {
      twoOrMoreSolos: { active: false, value: -2 },
      lowerTierAdversary: { active: false, value: 1 },
      noHeavyRoles: { active: false, value: 1 },
    };
    expect(computeTotalBudgetMod(autoMods, { damageBoostPlusOne: true, slightlyMoreDangerous: true })).toBe(0);
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
// collectSceneAdversaries / computeSceneTier (flat activeElements)
// ---------------------------------------------------------------------------
describe('collectSceneAdversaries', () => {
  it('returns empty array for a scene with no adversaries', () => {
    const scene = { id: 's1', activeElements: [] };
    expect(collectSceneAdversaries(scene)).toEqual([]);
  });

  it('ignores non-adversary elements', () => {
    const scene = sceneWithAdversaries([
      { instanceId: 'n1', elementType: 'note', name: 'A note' },
      { instanceId: 'e1', elementType: 'environment', name: 'Grove' },
      { instanceId: 'm1', elementType: 'mapImage', imageUrl: 'https://example.com/x.png' },
    ]);
    expect(collectSceneAdversaries(scene)).toEqual([]);
  });

  it('collects each adversary element as count 1', () => {
    const scene = sceneWithAdversaries([
      adv({ instanceId: 'a1', name: 'Goblin', role: 'minion', tier: 1 }),
      adv({ instanceId: 'a2', name: 'Goblin', role: 'minion', tier: 1 }),
    ]);
    const result = collectSceneAdversaries(scene);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ role: 'minion', tier: 1, count: 1, name: 'Goblin' });
    expect(result[1]).toMatchObject({ role: 'minion', tier: 1, count: 1, name: 'Goblin' });
  });

  it('ignores reserved minPartySize rows when characterCount is passed', () => {
    const scene = sceneWithAdversaries([
      adv({ instanceId: 'a1', name: 'Reaper', role: 'solo', tier: 3 }),
      adv({ instanceId: 'a2', name: 'Reaper', role: 'solo', tier: 3, minPartySize: 5 }),
    ]);
    expect(collectSceneAdversaries(scene, 4)).toHaveLength(1);
    expect(collectSceneAdversaries(scene, 5)).toHaveLength(2);
    expect(computeSceneBudget(scene, 4).bp).toBe(5);
    expect(computeSceneBudget(scene, 5).bp).toBe(10);
  });

  it('reads role/tier/name from the inline element (no library data)', () => {
    const scene = sceneWithAdversaries([
      adv({ instanceId: 'a1', name: 'Orc', role: 'bruiser', tier: 2 }),
    ]);
    const result = collectSceneAdversaries(scene);
    expect(result[0]).toMatchObject({ role: 'bruiser', tier: 2, count: 1, name: 'Orc' });
  });
});

describe('computeSceneTier', () => {
  it('returns null when there are no adversaries', () => {
    expect(computeSceneTier(sceneWithAdversaries([]))).toBeNull();
  });

  it('returns the max adversary tier', () => {
    const scene = sceneWithAdversaries([
      adv({ instanceId: 'a1', tier: 1, role: 'standard' }),
      adv({ instanceId: 'a2', tier: 3, role: 'solo' }),
      adv({ instanceId: 'a3', tier: 2, role: 'bruiser' }),
    ]);
    expect(computeSceneTier(scene)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// computeSceneBudget (no library `data` argument)
// ---------------------------------------------------------------------------
describe('computeSceneBudget', () => {
  it('computes bp/tier from activeElements and reads tableBattleMods', () => {
    const scene = sceneWithAdversaries(
      [
        adv({ instanceId: 'a1', role: 'bruiser', tier: 2, name: 'Ogre' }),
        adv({ instanceId: 'a2', role: 'standard', tier: 1, name: 'Goblin' }),
        adv({ instanceId: 'a3', role: 'standard', tier: 1, name: 'Goblin' }),
      ],
      { tableBattleMods: { moreDangerous: true } },
    );
    const result = computeSceneBudget(scene, 4, 1);
    expect(result.tier).toBe(2);
    // bruiser 4 + standard 2 + standard 2 = 8
    expect(result.bp).toBe(8);
    expect(result.budget).toBe(14);
    expect(result.userMods.moreDangerous).toBe(true);
    expect(result.totalMod).toBe(2); // moreDangerous only (has heavy roles, not 2 solos)
    expect(result.adjustedBudget).toBe(16);
  });

  it('counts minion BP from one-element-per-instance rows', () => {
    const scene = sceneWithAdversaries([
      adv({ instanceId: 'm1', role: 'minion', name: 'Rat' }),
      adv({ instanceId: 'm2', role: 'minion', name: 'Rat' }),
      adv({ instanceId: 'm3', role: 'minion', name: 'Rat' }),
      adv({ instanceId: 'm4', role: 'minion', name: 'Rat' }),
      adv({ instanceId: 'm5', role: 'minion', name: 'Rat' }),
    ]);
    // 5 minions / party of 4 = ceil(5/4) = 2 BP
    expect(computeSceneBudget(scene, 4).bp).toBe(2);
  });

  it('returns 0 bp and null tier for an empty scene', () => {
    const result = computeSceneBudget({ activeElements: [] }, 4);
    expect(result.bp).toBe(0);
    expect(result.tier).toBeNull();
  });
});
