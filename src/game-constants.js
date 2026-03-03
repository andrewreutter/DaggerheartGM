/**
 * Shared game constants used by both server-side modules and client-side code.
 *
 * All role definitions live here as the single source of truth. Any module that
 * needs ROLES or role-related logic should import from this file.
 */

export const ROLES = [
  'bruiser', 'horde', 'leader', 'minion', 'ranged',
  'skulk', 'social', 'solo', 'standard', 'support',
];

/**
 * Battle Point cost per adversary role.
 *
 * Minions are a special case: 1 BP per group equal to party size.
 * All other roles spend their flat cost per individual adversary.
 *
 * Rules:
 *   1 BP  — group of Minions equal to party size
 *   1 BP  — Social or Support adversary
 *   2 BP  — Horde, Ranged, Skulk, or Standard adversary
 *   3 BP  — Leader adversary
 *   4 BP  — Bruiser adversary
 *   5 BP  — Solo adversary
 */
export const ROLE_BP_COST = {
  minion:   null, // special: 1 BP per (partySize) group — computed separately
  social:   1,
  support:  1,
  horde:    2,
  ranged:   2,
  skulk:    2,
  standard: 2,
  leader:   3,
  bruiser:  4,
  solo:     5,
};

export const ENV_TYPES = ['traversal', 'exploration', 'social', 'event'];
export const TIERS = [1, 2, 3, 4];
