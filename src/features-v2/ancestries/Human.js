/**
 * Human Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Human.md
 */

import { when, isActing } from '../engine/when.js';

export const HighStamina = {
  name: 'High Stamina',
  description: 'Gain an additional Stress slot at character creation.',
  passiveStatMods: {
    maxStress: 1,
  },
};

export const Adaptability = {
  name: 'Adaptability',
  description: 'When you fail a roll that utilized one of your Experiences, you can mark a Stress to reroll.',
  chips: [
    when(
      isActing,
      (table) => table.rolls?.action?.isSuccess === false,
      {
        description: 'Mark 1 Stress to reroll.',
        placements: ['reviewOutcome'],
        stressCost: 1,
        onUse: (table) => {
          // Reroll both Hope and Fear dice
          // NOTE: SRD requires "when you fail a roll that utilized one of your Experiences"
          // but the V2 API does not expose experienceId, so this chip appears on any failed roll
          table.rolls?.action?.hopeDie?.reroll();
          table.rolls?.action?.fearDie?.reroll();
        },
      }
    ),
  ],
};
