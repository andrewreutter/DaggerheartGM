import { rollBeatsDefense } from './duality-roll-outcome.js';

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
 * Whether a pending roll should use `getTargetsForRoll` (map range filtering).
 * Character weapon attacks carry `_weaponRangeFt` even when there is no damage sub-item
 * (e.g. Katari Retracting Claws — Agility scratch with no damage line).
 *
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

function isAdversaryTarget(target) {
  return target?.type === 'adversary' || target?.elementType === 'adversary';
}

function isCharacterTarget(target) {
  return target?.type === 'character' || target?.elementType === 'character';
}

/**
 * Difficulty (adversary) or Evasion (character/companion) used for banner Hit/Miss.
 * Character targets add any pending one-shot evasion bonus from `getPendingEvasionBonus`.
 *
 * @param {object|null|undefined} target
 * @param {{ tableCharacters?: object[], getPendingEvasionBonus?: (el: object) => number }} [opts]
 * @returns {number|null}
 */
export function resolveAttackTargetDefense(target, opts = {}) {
  if (!target) return null;
  let defense = isAdversaryTarget(target) ? target.difficulty : target.evasion;
  if (isCharacterTarget(target)) {
    const full = (opts.tableCharacters || []).find((c) => c.instanceId === target.instanceId) || target;
    const pending = typeof opts.getPendingEvasionBonus === 'function'
      ? Number(opts.getPendingEvasionBonus(full)) || 0
      : 0;
    if (pending > 0) defense = (Number(defense) || 0) + pending;
  }
  const n = Number(defense);
  return Number.isFinite(n) ? n : null;
}

/**
 * @typedef {'hit'|'miss'|'unknown'} AttackTargetOutcome
 * `unknown` = no numeric defense (Hit/Miss is not shown; Acknowledge still applies damage).
 */

/**
 * @param {object} roll
 * @param {object|null|undefined} target
 * @param {{
 *   effectiveTotal?: number,
 *   tableCharacters?: object[],
 *   getPendingEvasionBonus?: (el: object) => number,
 *   forceHit?: boolean,
 * }} [opts]
 * @returns {AttackTargetOutcome}
 */
export function classifyAttackAgainstTarget(roll, target, opts = {}) {
  if (!target) return 'unknown';
  if (opts.forceHit) return 'hit';
  const defense = resolveAttackTargetDefense(target, opts);
  if (defense == null) return 'unknown';
  return rollBeatsDefense(roll, defense, opts.effectiveTotal) ? 'hit' : 'miss';
}

/**
 * Acknowledge applies HP only when the attack is not a known miss.
 * Skip still dismisses without damage.
 *
 * @param {object} roll
 * @param {object|null|undefined} target
 * @param {Parameters<typeof classifyAttackAgainstTarget>[2]} [opts]
 * @returns {boolean}
 */
export function shouldApplyDamageOnAcknowledge(roll, target, opts = {}) {
  return classifyAttackAgainstTarget(roll, target, opts) !== 'miss';
}

/**
 * @param {object} roll
 * @param {object[]} targets
 * @param {Parameters<typeof classifyAttackAgainstTarget>[2]} [opts]
 * @returns {{ hitCount: number, missCount: number }}
 */
export function countAttackHitsAndMisses(roll, targets, opts = {}) {
  let hitCount = 0;
  let missCount = 0;
  for (const target of targets || []) {
    const outcome = classifyAttackAgainstTarget(roll, target, opts);
    if (outcome === 'hit') hitCount++;
    else if (outcome === 'miss') missCount++;
  }
  return { hitCount, missCount };
}
