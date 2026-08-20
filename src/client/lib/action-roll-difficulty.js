// Pure helpers for GM-finalized difficulty on player-initiated non-attack action rolls.
// See docs/plans (gm_difficulty_finalization_for_player_action_rolls) for the full design.

/** Attack rolls (weapon/beastform/feature-with-target) always use target-based difficulty (evasion/adversary DC) — never this flow. */
export function isAttackRollMeta(meta = {}) {
  return meta._weaponRangeFt != null || meta._featureNeedsTarget === true;
}

/**
 * True when a pre-roll session uses the shared DC slider + Finalize lock:
 * not an attack (evasion / target DC) and not a GM-called reaction (those use the reaction DC).
 * Applies to both GM- and player-initiated non-attack rolls so neither party can Proceed early.
 */
export function sessionNeedsDifficulty(meta = {}) {
  return !isAttackRollMeta(meta) && meta._reactionCallRollDbId == null;
}

/**
 * True when a player-initiated roll needs the GM to set a difficulty before it can proceed:
 * an action roll (opened the "Before you roll" intent panel), not an attack, and not a
 * GM-called reaction roll (those use the reaction's own DC).
 */
export function requiresGmFinalizedDifficulty(meta = {}) {
  return meta._intentPanelForActionRoll === true && sessionNeedsDifficulty(meta);
}

/**
 * Reads the finalized difficulty for a pending pre-roll banner out of the latest `intent` SSE
 * update, if it matches the banner's `intentId` and has been finalized. Returns a finite number
 * or null (not yet finalized / mismatched intent).
 */
export function resolveFinalizedIntentDifficulty(banner, intentUpdate) {
  const needsDifficulty = !!(banner?.needsDifficulty || banner?.requiresGmDifficulty);
  if (!needsDifficulty || !banner.intentId) return null;
  if (!intentUpdate || intentUpdate.intentId !== banner.intentId) return null;
  if (intentUpdate.difficultyFinalized !== true) return null;
  const n = Number(intentUpdate.difficulty);
  return Number.isFinite(n) ? n : null;
}
