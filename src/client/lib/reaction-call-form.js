import { TRAIT_KEYS } from './character-calc.js';
import { DIFFICULTY_SLIDER_MAX, DIFFICULTY_SLIDER_MIN } from './helpers.js';

export const REACTION_CALL_DEFAULT_DIFFICULTY = 10;
export const REACTION_CALL_MIN_DIFFICULTY = DIFFICULTY_SLIDER_MIN;
export const REACTION_CALL_MAX_DIFFICULTY = DIFFICULTY_SLIDER_MAX;
export const REACTION_CALL_DEFAULT_TRAIT = TRAIT_KEYS[0];

/**
 * Shape the Call for Reaction submit payload.
 * `traitOverrides` only includes selected characters whose pick differs from the default trait.
 *
 * @param {object} opts
 * @param {Iterable<string>} opts.selectedIds
 * @param {object[]} [opts.characters]
 * @param {string} opts.trait
 * @param {number|string} opts.difficulty
 * @param {Record<string, string>} [opts.traitOverrides]
 * @returns {{ targetInstanceIds: string[], trait: string, difficulty: number, traitOverrides: Record<string, string> }}
 */
export function shapeReactionCallPayload({
  selectedIds,
  characters = [],
  trait,
  difficulty,
  traitOverrides = {},
} = {}) {
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const targetInstanceIds = characters
    .filter((c) => selected.has(c.instanceId))
    .map((c) => c.instanceId);
  const overrides = {};
  for (const instanceId of targetInstanceIds) {
    const pick = traitOverrides[instanceId];
    if (pick && pick !== trait && TRAIT_KEYS.includes(pick)) {
      overrides[instanceId] = pick;
    }
  }
  return {
    targetInstanceIds,
    trait,
    difficulty: Math.round(Number(difficulty)),
    traitOverrides: overrides,
  };
}
