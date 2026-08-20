/**
 * Table spotlight: who may take a voluntary action, plus catch-up counts from
 * acknowledged action / adversary d20 rolls.
 *
 * Framework-agnostic — imported by the client and `server.js`.
 */

import { isAttackRollMeta } from './action-roll-difficulty.js';
import { isReactionRoll } from './reaction-roll-display.js';
import { isDualityCritical, rollBeatsDefense } from './duality-roll-outcome.js';

export const DEFAULT_SPOTLIGHT = Object.freeze({
  holderType: null,
  holderInstanceId: null,
  rollSeq: 0,
  lastSeenSeq: Object.freeze({}),
});

/** @param {object | null | undefined} spotlight */
export function normalizeSpotlight(spotlight) {
  if (!spotlight || typeof spotlight !== 'object') return DEFAULT_SPOTLIGHT;
  const lastSeenSeq =
    spotlight.lastSeenSeq && typeof spotlight.lastSeenSeq === 'object' ? spotlight.lastSeenSeq : {};
  return {
    holderType: spotlight.holderType === 'gm' || spotlight.holderType === 'character' ? spotlight.holderType : null,
    holderInstanceId: spotlight.holderType === 'character' ? (spotlight.holderInstanceId ?? null) : null,
    rollSeq: Number.isFinite(spotlight.rollSeq) ? spotlight.rollSeq : 0,
    lastSeenSeq,
  };
}

/** @param {object | null | undefined} spotlight @param {string | null | undefined} instanceId */
export function isSpotlightHolder(spotlight, instanceId) {
  if (instanceId == null || instanceId === '') return false;
  const s = normalizeSpotlight(spotlight);
  return s.holderType === 'character' && s.holderInstanceId === instanceId;
}

/** @param {object | null | undefined} spotlight */
export function isGmHolder(spotlight) {
  return normalizeSpotlight(spotlight).holderType === 'gm';
}

/**
 * Catch-up for a character instanceId (`rollSeq - lastSeenSeq[key]`).
 * The GM token does not track rolls-since-spotlight — always 0 for `'gm'`.
 */
export function spotlightCatchUpCount(spotlight, key) {
  if (key == null || key === '' || key === 'gm') return 0;
  const s = normalizeSpotlight(spotlight);
  const seen = s.lastSeenSeq?.[key];
  const last = Number.isFinite(seen) ? seen : 0;
  return s.rollSeq - last;
}

/** Inactive-beam opacity: 0 → 0.16, then +0.16 per catch-up, capped well below the active beam. */
export const SPOTLIGHT_ACTIVE_BEAM_OPACITY = 0.98;
/** GM crown beam has no catch-up count — keep it readable even when inactive. */
export const SPOTLIGHT_GM_INACTIVE_BEAM_OPACITY = 0.50;
const INACTIVE_BEAM_OPACITY_BASE = 0.16;
const INACTIVE_BEAM_OPACITY_STEP = 0.16;
const INACTIVE_BEAM_OPACITY_MAX = 0.70;

export function spotlightInactiveBeamOpacity(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return Math.min(INACTIVE_BEAM_OPACITY_MAX, INACTIVE_BEAM_OPACITY_BASE + n * INACTIVE_BEAM_OPACITY_STEP);
}

/**
 * Beam fill opacity. Character trays scale by catch-up; the GM beam uses
 * `minOpacity` so it never drops below ~50% when inactive.
 */
export function spotlightBeamOpacity(active, { count = 0, minOpacity = 0 } = {}) {
  if (active) return SPOTLIGHT_ACTIVE_BEAM_OPACITY;
  const floor = Number.isFinite(minOpacity) ? Math.max(0, minOpacity) : 0;
  return Math.max(floor, spotlightInactiveBeamOpacity(count));
}

/**
 * Hover copy for a character tray spotlight beam.
 * @param {number} count
 * @param {string | null | undefined} name
 * @param {{ active?: boolean }} [opts]
 */
export function spotlightCharacterTooltip(count, name, { active = false } = {}) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const who = typeof name === 'string' && name.trim() ? name.trim() : 'character';
  const first = `${n} turns since last Spotlight.`;
  const reset = 'Shift-click to reset the counter.';
  if (active) return `${first}\nClick to clear Spotlight.\n${reset}`;
  return `${first}\nClick to give Spotlight to ${who}.\n${reset}`;
}

/**
 * Stamp a character's `lastSeenSeq` to the current `rollSeq` so their catch-up
 * counter reads 0. Does not change the holder. No-op (same reference) for `'gm'`,
 * a missing id, or a counter that is already 0.
 * @param {object | null | undefined} spotlight
 * @param {string | null | undefined} instanceId
 */
export function resetSpotlightCatchUp(spotlight, instanceId) {
  if (instanceId == null || instanceId === '' || instanceId === 'gm') {
    return spotlight && typeof spotlight === 'object' ? spotlight : DEFAULT_SPOTLIGHT;
  }
  const current = normalizeSpotlight(spotlight);
  const seen = current.lastSeenSeq?.[instanceId];
  const last = Number.isFinite(seen) ? seen : 0;
  if (last === current.rollSeq) {
    return spotlight && typeof spotlight === 'object' ? spotlight : current;
  }
  return {
    holderType: current.holderType,
    holderInstanceId: current.holderInstanceId,
    rollSeq: current.rollSeq,
    lastSeenSeq: { ...current.lastSeenSeq, [instanceId]: current.rollSeq },
  };
}

/** True when play is allowed and no one currently holds the spotlight. */
export function showChooseSpotlightBanner(sessionPlayAllowed, spotlight) {
  return sessionPlayAllowed === true && spotlightHolderKey(spotlight) == null;
}

/** Current holder's catch-up key (`'gm'` or instanceId), or null when open. */
export function spotlightHolderKey(spotlight) {
  const s = normalizeSpotlight(spotlight);
  if (s.holderType === 'gm') return 'gm';
  if (s.holderType === 'character') return s.holderInstanceId;
  return null;
}

/**
 * Character keys tied for the highest catch-up among *inactive* PCs (the current
 * holder and `'gm'` are skipped). Empty when the max is ≤ 0 (nothing to hint).
 */
export function highestCatchUpKeys(spotlight, allKeys) {
  if (!Array.isArray(allKeys) || allKeys.length === 0) return [];
  const holderKey = spotlightHolderKey(spotlight);
  let max = -Infinity;
  const tied = [];
  for (const key of allKeys) {
    if (key === holderKey || key === 'gm') continue;
    const n = spotlightCatchUpCount(spotlight, key);
    if (n > max) {
      max = n;
      tied.length = 0;
      tied.push(key);
    } else if (n === max) {
      tied.push(key);
    }
  }
  if (max <= 0) return [];
  return tied;
}

/**
 * `'action'` — PC Duality action (Fear/failure → GM; successful Hope/Critical → open).
 * `'adversary'` — GM/adversary d20 (seq only).
 * `null` — damage-only, manual dice, reaction, rest, etc.
 */
export function qualifiesForSpotlightRoll(roll) {
  if (!roll || typeof roll !== 'object') return null;
  if (roll._attackerType === 'adversary') return 'adversary';
  if (isReactionRoll(roll) || roll._rest) return null;
  if (roll.dominant != null && roll._attackerInstanceId != null) return 'action';
  return null;
}

/**
 * Voluntary player action (intent-panel trait/feature or attack) — not a reaction,
 * rest, or `rollThenResume` mechanical die.
 */
export function isSpotlightGatedRollMeta(rollMeta) {
  if (!rollMeta || typeof rollMeta !== 'object') return false;
  if (rollMeta._isReaction || rollMeta._reactionCallRollDbId) return false;
  if (rollMeta._tagTeamIntentId && rollMeta._tagTeamRole === 'partner') return false;
  if (rollMeta._rest) return false;
  if (rollMeta._v2PhysicalRollResume) return false;
  return rollMeta._intentPanelForActionRoll === true || isAttackRollMeta(rollMeta);
}

/**
 * Manual GM assignment. Does not change `rollSeq` / `lastSeenSeq`.
 * Clicking the current holder again clears the spotlight (open).
 * @param {'gm' | 'character' | null} holderType
 */
export function assignSpotlightHolder(spotlight, holderType, holderInstanceId = null) {
  const current = normalizeSpotlight(spotlight);
  const nextType = holderType === 'gm' || holderType === 'character' ? holderType : null;
  const nextInstanceId = nextType === 'character' ? (holderInstanceId ?? null) : null;
  const togglingOff =
    nextType != null &&
    nextType === current.holderType &&
    (nextType !== 'character' || nextInstanceId === current.holderInstanceId);
  return {
    holderType: togglingOff ? null : nextType,
    holderInstanceId: togglingOff || nextType !== 'character' ? null : nextInstanceId,
    rollSeq: current.rollSeq,
    lastSeenSeq: { ...current.lastSeenSeq },
  };
}

/**
 * Force-assign spotlight to a character (GM ack of a request). Never toggles off
 * when that PC already holds it. Preserves `rollSeq` / `lastSeenSeq`.
 * @param {object | null | undefined} spotlight
 * @param {string | null | undefined} instanceId
 */
export function grantSpotlightToCharacter(spotlight, instanceId) {
  const current = normalizeSpotlight(spotlight);
  return {
    holderType: 'character',
    holderInstanceId: instanceId ?? null,
    rollSeq: current.rollSeq,
    lastSeenSeq: { ...current.lastSeenSeq },
  };
}

/**
 * True when a PC Duality action should hand spotlight to the GM: Fear, or a failed
 * roll. Critical is always a success with Hope.
 */
export function actionRollPassesSpotlightToGm(roll) {
  if (!roll || typeof roll !== 'object') return false;
  if (roll.dominant === 'fear') return true;
  if (isDualityCritical(roll)) return false;
  if (roll.isSuccess === false) return true;
  if (roll.isSuccess === true) return false;
  if (roll._difficulty != null) return !rollBeatsDefense(roll, roll._difficulty);
  return false;
}

/**
 * Acknowledge-time reducer. Returns the same reference when the roll does not qualify.
 */
export function applySpotlightRollAck(spotlight, roll) {
  const current = normalizeSpotlight(spotlight);
  const qual = qualifiesForSpotlightRoll(roll);
  if (!qual) return spotlight && typeof spotlight === 'object' ? spotlight : current;

  const rollSeq = current.rollSeq + 1;
  const lastSeenSeq = { ...current.lastSeenSeq };

  if (qual === 'action') {
    const attackerId = roll._attackerInstanceId;
    if (attackerId) lastSeenSeq[attackerId] = rollSeq;
    if (actionRollPassesSpotlightToGm(roll)) {
      return { holderType: 'gm', holderInstanceId: null, rollSeq, lastSeenSeq };
    }
    if (roll.dominant === 'hope' || roll.dominant === 'critical') {
      return { holderType: null, holderInstanceId: null, rollSeq, lastSeenSeq };
    }
  }

  return {
    holderType: current.holderType,
    holderInstanceId: current.holderInstanceId,
    rollSeq,
    lastSeenSeq,
  };
}
