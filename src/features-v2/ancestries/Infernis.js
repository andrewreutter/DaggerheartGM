/**
 * Infernis Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Infernis.md
 */

import { when, isActing } from '../engine/when.js';

export const Fearless = {
  name: 'Fearless',
  description: 'When you roll with Fear, you can mark 2 Stress to change it into a roll with Hope instead.',
  chips: [
    when(
      isActing,
      (table) => table.rolls?.action?.fearDie,
      {
        description: 'Mark 2 Stress to change Fear into Hope.',
        placements: ['reviewOutcome'],
        stressCost: 2,
        onUse: (table) => {
          // NOTE: SRD requires "When you roll with Fear" but V2 API cannot distinguish
          // "rolling with Fear" vs "rolling with Hope". This is a best-effort implementation.
          // Reroll the fear die - the engine should interpret this as Hope instead of Fear
          // This may require engine support for changing roll type
          if (table.rolls?.action?.fearDie) {
            table.rolls.action.fearDie.reroll();
          }
        },
      }
    ),
  ],
};

export const DreadVisage = {
  name: 'Dread Visage',
  description: 'You have advantage on rolls to intimidate hostile creatures.',
  advantageTriggers: [
    'rolls to intimidate hostile creatures',
  ],
};
