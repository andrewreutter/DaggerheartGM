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

/** Descriptions for each role (primary + RightKnight guide). */
export const ROLE_DESCRIPTIONS = {
  bruiser:  'Tough; deliver powerful attacks. Throw people around and make big hits.',
  horde:    'Groups of identical creatures acting together as a single unit. Consist of a large group of individually weak creatures.',
  leader:   'Command and summon other adversaries. Command others to attack the PCs.',
  minion:   'Easily dispatched but dangerous in numbers. Consist of a large group of individually weak creatures.',
  ranged:   'Fragile in close encounters but deal high damage at range. Attack from far away and keep pressure on the party.',
  skulk:    'Maneuver and exploit opportunities to ambush opponents. Harry the party as a Skirmisher in close quarters.',
  social:   'Present challenges around conversation instead of combat. Handle social encounters and challenges.',
  solo:     'Present a formidable challenge to a whole party, with or without support. Have a lot of complicated moves that build on each other.',
  standard: 'Representative of their fictional group. Have simple abilities and make up the core of your forces.',
  support:  'Enhance their allies and disrupt their opponents. Cause debuffs and aid allies.',
};

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

/** Default filled Hope boxes for a newly created PC (max pool remains 6). */
export const DEFAULT_CHARACTER_STARTING_HOPE = 2;

/**
 * Global, numeric ceiling on which domain-card (ability) tiers render V2 card chips (interactive
 * Use/cost UI). Purely structural gate — no per-card or per-domain branching anywhere it's read.
 * Starts at 0 (no domain-card chips render at all); raise to 1 once Tier 1 automation is complete
 * across all 9 domains. See docs/plans/productize-daggertop-subscription-decisions.md §3.
 */
export const RELEASED_ABILITY_TIER_CEILING = 0;

/**
 * V2 `featureState[scope][key]` — one-time Evasion bonus vs a pending attack (declarative features).
 * Engine mutations and Game Table banner math use this key; feature modules own the scope bag.
 */
export const PENDING_EVASION_BONUS_STATE_KEY = 'pendingEvasionBonus';

/**
 * Synthetic `items.user_id` for Fresh Cut Grass catalog content (no Firebase Auth).
 * Rows are `is_public: true` and appear in the Library like any other public item.
 */
export const FCG_PUBLIC_USER_ID = '__FCG_PUBLIC__';
