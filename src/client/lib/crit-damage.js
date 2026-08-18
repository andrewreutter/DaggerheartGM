/**
 * Critical-hit extra damage: max value of the damage dice (no modifiers).
 * Detection of which rolls are crits lives in `duality-roll-outcome.js`.
 */

import { maxDamageDiceValue } from './dice-utils.js';
import { isAttackCritical } from './duality-roll-outcome.js';

function isDamageSubItem(sub) {
  return !!sub && /damage/i.test(sub.pre || '') && !!sub.input;
}

/**
 * Extra damage on a crit: sum of max dice values across damage sub-items.
 * Does not include static modifiers (`2d8+5` → 16, not 21).
 * @param {object[] | null | undefined} subItems
 * @returns {number}
 */
export function critExtraDamageFromSubItems(subItems) {
  let extra = 0;
  for (const sub of subItems || []) {
    if (!isDamageSubItem(sub)) continue;
    extra += maxDamageDiceValue(sub.input);
  }
  return extra;
}

/**
 * Extra crit damage for a roll, or 0 when the roll is not a critical.
 * @param {object | null | undefined} roll
 * @returns {number}
 */
export function critExtraDamageForRoll(roll) {
  if (!isAttackCritical(roll)) return 0;
  return critExtraDamageFromSubItems(roll.subItems);
}
