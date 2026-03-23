/**
 * SRD item — Corrector Sprite (roll table 21)
 *
 * Once per short rest, gain advantage on an attack roll.
 */

import { when, isActing } from '../engine/when.js';

export const CorrectorSprite = {
  name: 'Corrector Sprite',
  description:
    'This tiny sprite sits in the curve of your ear canal and whispers helpful advice during combat. Once per short rest, you can gain advantage on an attack roll.',
  chips: [
    when(isActing, (table) => table.action?.type === 'attack', {
      name: 'Corrector Sprite',
      placements: ['intent'],
      frequency: 'shortRest',
      description: 'Gain advantage on this attack roll (once per short rest).',
      onUse(table) {
        table.rolls?.action?.addAdvantageDie('Corrector Sprite');
      },
    }),
  ],
};
