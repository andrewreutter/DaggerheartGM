/**
 * Daggerheart attack/action outcomes: Duality matching dice is a Critical (always
 * a success with Hope). Adversaries crit on a natural 20. Both auto-hit.
 */

import { parseDiceExpr, parseSubDetails } from './dice-utils.js';

/** @param {object | null | undefined} roll */
export function isDualityCritical(roll) {
  return !!roll && roll.dominant === 'critical';
}

/** Hope die higher, or Critical (doubles). */
export function isSuccessWithHope(roll) {
  return !!roll && (roll.dominant === 'hope' || roll.dominant === 'critical');
}

function isDamageSubItem(sub) {
  return !!sub && /damage/i.test(sub.pre || '') && !!sub.input;
}

function isDualityRoll(roll) {
  if (!roll) return false;
  if (roll.dominant === 'hope' || roll.dominant === 'fear' || roll.dominant === 'critical') return true;
  const subs = roll.subItems || [];
  const hasHope = subs.some((s) => /hope/i.test(s.pre || ''));
  const hasFear = subs.some((s) => /fear/i.test(s.pre || ''));
  return hasHope && hasFear;
}

/** True when a non-damage d20 sub-item shows a natural 20 face. */
export function isNatural20SubItem(sub) {
  if (!sub || isDamageSubItem(sub)) return false;
  const parsed = parseDiceExpr(sub.input);
  if (!parsed || parsed.sides !== 20) return false;
  const { all } = parseSubDetails(sub.details);
  if (all && all.length) {
    if (parsed.keep) return all[all.length - 1] === 20;
    return all.includes(20);
  }
  const total = parseInt(sub.result, 10);
  if (Number.isNaN(total)) return false;
  return (total - parsed.modifier) === 20;
}

/** Adversary (or any non-Duality) attack die showing a natural 20. */
export function isAdversaryNatural20(roll) {
  if (!roll || isDualityRoll(roll)) return false;
  return (roll.subItems || []).some(isNatural20SubItem);
}

/** Duality doubles, or an adversary natural 20. */
export function isAttackCritical(roll) {
  return isDualityCritical(roll) || isAdversaryNatural20(roll);
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
 * Whether an action/attack meets a DC, Difficulty, or Evasion.
 * Duality Critical and adversary natural 20 always succeed. Pass `effectiveTotal`
 * when the caller already added extras (e.g. ResultBanner prayer die); otherwise
 * {@link effectiveDualityTotal} is used.
 *
 * @param {object | null | undefined} roll
 * @param {number | null | undefined} defense
 * @param {number} [effectiveTotal]
 * @returns {boolean}
 */
export function rollBeatsDefense(roll, defense, effectiveTotal) {
  if (isAttackCritical(roll)) return true;
  const dc = Number(defense);
  if (!Number.isFinite(dc)) return false;
  const total = effectiveTotal != null ? Number(effectiveTotal) || 0 : effectiveDualityTotal(roll);
  return total >= dc;
}
