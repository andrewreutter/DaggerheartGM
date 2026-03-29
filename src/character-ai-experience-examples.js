/**
 * Example experience phrases for character AI prompts (Daggerheart-style: short story hooks, not skill lists).
 * Not SRD rows — creation is free-form; these illustrate tone and split between action and non-combat.
 */
export const CHARACTER_AI_EXPERIENCE_EXAMPLES = {
  note:
    'Experiences are short phrases describing where the PC gained expertise. Score is usually 2 at creation (0–3).',
  /** Fights, danger, physical pressure — good default +2 when spending Hope on those rolls */
  action_conflict: [
    'Street brawls in the dock ward',
    'Surviving the northern border raids',
    'Dueling in tournament circles',
    'Boarding actions as a privateer',
  ],
  /** Investigation, society, travel, craft — good default +2 outside straight combat */
  exploration_social: [
    'Apprenticing under a royal archivist',
    'Running messages for the thieves guild',
    'Caravan escort across the salt flats',
    'Negotiating contracts for a merchant house',
  ],
};
