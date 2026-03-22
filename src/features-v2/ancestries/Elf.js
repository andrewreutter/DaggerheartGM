/**
 * Elf Ancestry Features
 */

import { when, isActing } from '../engine/when.js';

/**
 * Quick Reactions: Mark a Stress to gain advantage on a reaction roll.
 * 
 * This is an intent-phase chip that adds an advantage die to action rolls.
 */
export const QuickReactions = {
  name: 'Quick Reactions',
  description: 'Mark a Stress to gain advantage on a reaction roll.',
  
  chips: [
    when(
      isActing,
      (table) => {
        // Available on reaction rolls during intent phase
        return table.action?.isReaction;
      },
      {
        name: 'Quick Reactions',
        description: 'Mark a Stress to gain advantage on this roll.',
        placements: ['intent'],
        stressCost: 1,
        isToggle: true,
        onUse: (table, chipState) => {
          if (chipState.isOn) {
            table.rolls?.action?.addAdvantageDie('Quick Reactions');
          } else {
            table.rolls?.action?.removeDie('Quick Reactions');
          }
        },
      }
    ),
  ],
};

/**
 * Celestial Trance: During a rest, you can drop into a trance to choose an additional downtime move.
 */
export const CelestialTrance = {
  name: 'Celestial Trance',
  description: 'During a rest, you can drop into a trance to choose an additional downtime move.',
  passiveStatMods: {
    numShortRestSlots: 1,
    numLongRestSlots: 1,
  },
};
