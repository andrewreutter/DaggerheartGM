/**
 * Daggerheart Duality outcomes: matching Hope/Fear dice is a Critical — always a
 * success with Hope (never a miss / failure, never with Fear).
 */

/** @param {object | null | undefined} roll */
export function isDualityCritical(roll) {
  return !!roll && roll.dominant === 'critical';
}

/** Hope die higher, or Critical (doubles). */
export function isSuccessWithHope(roll) {
  return !!roll && (roll.dominant === 'hope' || roll.dominant === 'critical');
}

/**
 * Action total including a selected Prayer Die add, matching ResultBanner math.
 * @param {object | null | undefined} roll
 */
export function effectiveDualityTotal(roll) {
  let total = Number(roll?.total) || 0;
  if (roll?.dominant != null) {
    total += Number(roll._prayerAddRollDie?.value) || 0;
  }
  return total;
}

/**
 * Whether a Duality action/attack meets a DC, Difficulty, or Evasion.
 * Critical always succeeds. Pass `effectiveTotal` when the caller already added extras
 * (e.g. ResultBanner prayer die); otherwise {@link effectiveDualityTotal} is used.
 *
 * @param {object | null | undefined} roll
 * @param {number | null | undefined} defense
 * @param {number} [effectiveTotal]
 * @returns {boolean}
 */
export function rollBeatsDefense(roll, defense, effectiveTotal) {
  if (isDualityCritical(roll)) return true;
  const dc = Number(defense);
  if (!Number.isFinite(dc)) return false;
  const total = effectiveTotal != null ? Number(effectiveTotal) || 0 : effectiveDualityTotal(roll);
  return total >= dc;
}
