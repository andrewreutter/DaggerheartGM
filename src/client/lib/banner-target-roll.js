/**
 * Whether a pending roll should use `getTargetsForRoll` (map range filtering).
 * Character weapon attacks carry `_weaponRangeFt` even when there is no damage sub-item
 * (e.g. Katari Retracting Claws — Agility scratch with no damage line).
 */

/**
 * Whether Hit/Miss (vs target Difficulty / Evasion) should show on the result banner.
 * Damage-based attacks always qualify; PC attacks with range or virtual-weapon target flow
 * qualify even with no damage sub-item (e.g. Retracting Claws).
 *
 * @param {object} roll — pending banner roll meta
 * @param {boolean} hasDamage — derived from parsed damage sub-items
 * @returns {boolean}
 */
export function rollIsHitMissEligibleAttack(roll, hasDamage) {
  if (!roll) return false;
  if (hasDamage) return true;
  return (
    roll._attackerInstanceId != null &&
    roll._attackerType !== 'adversary' &&
    (roll._weaponRangeFt != null || roll._featureNeedsTarget === true)
  );
}

/**
 * @param {object} roll — pending banner roll meta
 * @param {boolean} hasDamage — derived from parsed damage sub-items
 * @returns {boolean}
 */
export function rollShouldUseMapFilteredTargets(roll, hasDamage) {
  if (!roll) return false;
  if (roll._featureNeedsTarget) return true;
  if (!roll._attackerInstanceId) return false;
  const isPcAttack = roll._attackerType !== 'adversary';
  if (roll._weaponRangeFt != null && (hasDamage || isPcAttack)) return true;
  if (roll._attackerType === 'adversary' && roll._attackRangeFt != null && hasDamage) return true;
  return false;
}
