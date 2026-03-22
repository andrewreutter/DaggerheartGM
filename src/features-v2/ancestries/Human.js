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
      (table) => {
        const expNames = new Set((table.me?.experiences || []).map((e) => e.name));
        return (table.rolls?.action?.statics || []).some((s) => expNames.has(s.name));
      },
      {
        description: 'Mark 1 Stress to reroll.',
        placements: ['reviewAction'],
        stressCost: 1,
        onUse: (table) => {
          table.rolls?.action?.hopeDie?.reroll();
          table.rolls?.action?.fearDie?.reroll();
        },
      }
    ),
  ],
};
