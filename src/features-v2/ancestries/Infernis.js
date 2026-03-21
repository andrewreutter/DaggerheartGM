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
        placements: ['reviewAction'],
        stressCost: 2,
        // NOTE: SRD requires "When you roll with Fear" but V2 API cannot distinguish
        // "rolling with Fear" vs "rolling with Hope" at chip-display time, so the chip
        // appears on any roll with a fearDie (accepted best-effort per tracker).
        onUse: (table) => {
          table.rolls?.action?.setOutcome('hope');
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
