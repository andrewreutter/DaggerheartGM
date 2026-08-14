/**
 * Battle Points (BP) calculation utilities for Scene combat budgeting.
 *
 * The Scene library row is a flat, self-contained snapshot of table_state:
 * adversaries live as full inline copies on `scene.activeElements` (elementType
 * `'adversary'`). There is no nested-scene graph and no external library `data`
 * lookup — BP/tier are derived directly from those elements.
 *
 * Rules source: Daggerheart GM guide for building combat encounters.
 *
 * Base budget = (3 × number of PCs) + 2
 *
 * BP cost per adversary role:
 *   Minions  — 1 BP per group equal to party size
 *   Social / Support — 1 BP each
 *   Horde / Ranged / Skulk / Standard — 2 BP each
 *   Leader — 3 BP each
 *   Bruiser — 4 BP each
 *   Solo — 5 BP each
 *
 * Budget modifiers (auto-detected from scene content):
 *   -2  if 2 or more Solo adversaries
 *   +1  if any adversary is from a lower tier than the party's highest character tier
 *   +1  if no Bruisers, Hordes, Leaders, or Solos are present
 *
 * Budget modifiers (user-controlled via `tableBattleMods` on the scene):
 *   -1  lessDifficult          — fight should be less difficult or shorter
 *   -1  damageBoostPlusOne     — all adversaries deal +1 extra damage
 *   -2  damageBoostD4          — all adversaries deal +1d4 extra damage
 *   -2  damageBoostStatic      — all adversaries deal +2 extra damage
 *   +1  slightlyMoreDangerous  — fight should be slightly more dangerous or slightly longer
 *   +2  moreDangerous          — fight should be more dangerous or last longer
 *
 * Denormalized `scene.tier` / `scene.bp` are stamped by the Scene editor on
 * every change so Library cards can read them without recomputing.
 */

import { ROLE_BP_COST } from './constants.js';

// ---------------------------------------------------------------------------
// Adversary collection (flat activeElements — no nesting, no library lookup)
// ---------------------------------------------------------------------------

/**
 * Returns a flat array of { role, tier, count, name } for every adversary
 * element on the scene. Each `elementType === 'adversary'` row is one instance
 * (`count: 1`).
 *
 * @param {object} scene  - scene item data (`activeElements` array)
 * @returns {{ role: string, tier: number, count: number, name: string }[]}
 */
export function collectSceneAdversaries(scene) {
  const result = [];
  for (const el of scene?.activeElements || []) {
    if (!el || el.elementType !== 'adversary') continue;
    result.push({
      role: el.role || 'standard',
      tier: el.tier ?? 1,
      count: 1,
      name: el.name || '',
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Scene tier derivation
// ---------------------------------------------------------------------------

/**
 * Returns the highest adversary tier among `scene.activeElements`.
 * Returns null when no adversaries are present.
 *
 * @param {object} scene
 * @returns {number|null}
 */
export function computeSceneTier(scene) {
  const adversaries = collectSceneAdversaries(scene);
  if (adversaries.length === 0) return null;
  return Math.max(...adversaries.map(a => a.tier ?? 1));
}

// ---------------------------------------------------------------------------
// Battle Points cost
// ---------------------------------------------------------------------------

/**
 * Compute total BP cost for a scene.
 *
 * @param {{ role: string, tier: number, count: number }[]} adversaries
 * @param {number} partySize
 * @returns {number}
 */
export function computeBattlePoints(adversaries, partySize = 4) {
  let total = 0;
  let minionTotal = 0;

  for (const { role, count } of adversaries) {
    if (role === 'minion') {
      minionTotal += count;
    } else {
      const cost = ROLE_BP_COST[role] ?? ROLE_BP_COST.standard;
      total += cost * count;
    }
  }

  if (minionTotal > 0) {
    total += Math.ceil(minionTotal / Math.max(1, partySize));
  }

  return total;
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

/**
 * Base GM budget for a combat encounter.
 *
 * @param {number} partySize - number of PCs in the encounter
 * @returns {number}
 */
export function computeBudget(partySize = 4) {
  return 3 * partySize + 2;
}

// ---------------------------------------------------------------------------
// Auto-detected modifiers
// ---------------------------------------------------------------------------

/**
 * Compute modifiers that can be inferred automatically from the scene content.
 *
 * Returns an object describing each modifier: { active: boolean, value: number, label: string }
 *
 * @param {{ role: string, tier: number, count: number }[]} adversaries
 * @param {number|null} partyTier - highest tier among player characters (or null if no characters)
 * @returns {{ twoOrMoreSolos, lowerTierAdversary, noHeavyRoles }}
 */
export function computeAutoModifiers(adversaries, partyTier) {
  const soloCount = adversaries.reduce((n, a) => n + (a.role === 'solo' ? a.count : 0), 0);
  const heavyRoles = new Set(['bruiser', 'horde', 'leader', 'solo']);
  const hasHeavy = adversaries.some(a => heavyRoles.has(a.role));
  const lowerTierItems = partyTier != null ? adversaries.filter(a => (a.tier ?? 1) < partyTier) : [];
  const hasLowerTier = lowerTierItems.length > 0;

  return {
    twoOrMoreSolos: {
      active: soloCount >= 2,
      value: -2,
      label: '2+ Solos',
    },
    lowerTierAdversary: {
      active: hasLowerTier,
      value: +1,
      label: 'Lower-tier adversary',
      // Extra context for display: the party tier used and which adversaries are below it.
      partyTier: partyTier ?? null,
      lowerTierItems, // [{ role, tier, count, name? }]
    },
    noHeavyRoles: {
      active: adversaries.length > 0 && !hasHeavy,
      value: +1,
      label: 'No heavy roles',
    },
  };
}

// ---------------------------------------------------------------------------
// Total budget modifier
// ---------------------------------------------------------------------------

/**
 * Sum all budget modifiers (auto + user) into a single number.
 *
 * @param {{ twoOrMoreSolos, lowerTierAdversary, noHeavyRoles }} autoMods
 * @param {{ lessDifficult?: boolean, slightlyMoreDangerous?: boolean, damageBoostPlusOne?: boolean, damageBoostD4?: boolean, damageBoostStatic?: boolean, moreDangerous?: boolean }} userMods
 * @returns {number}
 */
export function computeTotalBudgetMod(autoMods, userMods = {}) {
  let mod = 0;

  if (autoMods.twoOrMoreSolos?.active) mod += autoMods.twoOrMoreSolos.value;
  if (autoMods.lowerTierAdversary?.active) mod += autoMods.lowerTierAdversary.value;
  if (autoMods.noHeavyRoles?.active) mod += autoMods.noHeavyRoles.value;

  if (userMods.lessDifficult) mod -= 1;
  if (userMods.damageBoostPlusOne) mod -= 1;
  if (userMods.damageBoostD4) mod -= 2;
  if (userMods.damageBoostStatic) mod -= 2;
  if (userMods.slightlyMoreDangerous) mod += 1;
  if (userMods.moreDangerous) mod += 2;

  return mod;
}

// ---------------------------------------------------------------------------
// Damage boost helpers
// ---------------------------------------------------------------------------

/**
 * Append a damage boost to a damage string like "2d6" → "2d6+1d4" or "2d6+2".
 *
 * @param {string} damageStr - e.g. "2d8" or "1d12+2"
 * @param {'d4'|'static'} boostType
 * @returns {string}
 */
export function applyDamageBoost(damageStr, boostType) {
  if (!damageStr) return damageStr;
  const boost = boostType === 'd4' ? '+1d4' : boostType === 'plusOne' ? '+1' : '+2';
  return `${damageStr}${boost}`;
}

// ---------------------------------------------------------------------------
// Convenience: all scene BP stats in one call
// ---------------------------------------------------------------------------

function sceneUserMods(scene) {
  return scene?.tableBattleMods || scene?.battleMods || {};
}

/**
 * Compute the full battle budget summary for a scene.
 *
 * @param {object} scene      - scene item data (flat `activeElements` + `tableBattleMods`)
 * @param {number} partySize
 * @param {number|null} partyTier - highest tier among player characters; used for the
 *   "lower-tier adversary" auto-modifier. Defaults to null (modifier inactive).
 * @returns {{
 *   tier: number|null,
 *   adversaries: { role, tier, count }[],
 *   bp: number,
 *   budget: number,
 *   autoMods: object,
 *   userMods: object,
 *   totalMod: number,
 *   adjustedBudget: number,
 * }}
 */
export function computeSceneBudget(scene, partySize = 4, partyTier = null) {
  const adversaries = collectSceneAdversaries(scene);
  const tier = computeSceneTier(scene);
  const bp = computeBattlePoints(adversaries, partySize);
  const budget = computeBudget(partySize);
  const autoMods = computeAutoModifiers(adversaries, partyTier);
  const userMods = sceneUserMods(scene);
  const totalMod = computeTotalBudgetMod(autoMods, userMods);
  const adjustedBudget = budget + totalMod;

  return { tier, adversaries, bp, budget, autoMods, userMods, totalMod, adjustedBudget };
}
