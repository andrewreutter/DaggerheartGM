/**
 * Roll Wrapper — wraps a raw roll object with utility methods so feature
 * hooks have a clean API instead of inline regex + array searches.
 *
 * wrapRoll(roll) is called when building hook contexts (GMTableView) and
 * before dispatching bannerStatus (DiceRoller).
 */
import { extractDetailsValues } from '../client/lib/dice-utils.js';

function wrapSubItem(sub) {
  return {
    ...sub,
    /** All individual die values from this sub-item's details. */
    values() {
      return extractDetailsValues(sub.details);
    },
    /** True if any die in this sub-item rolled the given value. */
    hasValue(n) {
      return extractDetailsValues(sub.details).some(v => v === n);
    },
  };
}

/**
 * Wrap a raw server roll object with utility methods.
 * Pass into hook contexts so feature modules have a clean API.
 *
 * @param {object|null} roll
 * @returns {object|null} wrapped roll, or null if roll is falsy
 */
export function wrapRoll(roll) {
  if (!roll) return null;
  return {
    ...roll,
    /**
     * Find a sub-item whose `pre` label matches pattern (string → case-insensitive
     * regex, RegExp → used as-is). Returns a wrapped sub-item with .values() and
     * .hasValue() helpers, or null if not found.
     */
    sub(pattern) {
      const re = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
      const found = (roll.subItems || []).find(s => re.test(s.pre || ''));
      return found ? wrapSubItem(found) : null;
    },
  };
}
