/**
 * Splendor domain — Reassurance (Tier 1)
 * SRD: Once per rest, after an ally attempts an action roll but before consequences, they may reroll their dice.
 */

import { when } from '../../engine/when.js';

export const Reassurance = {
  name: 'Reassurance',
  description:
    'Once per rest, after an ally attempts an action roll but before the consequences take place, you can offer assistance or words of support. When you do, your ally can reroll their dice.',
  chips: [
    when(
      (table) => {
        if (!table.rolls?.action) return false;
        if (table.me.isActing) return false;
        const actor = table.action?.actor;
        if (!actor?.isCharacter) return false;
        return actor.instanceId !== table.me.instanceId;
      },
      {
        name: 'Reassurance',
        placements: ['reviewAction'],
        frequency: 'rest',
        description:
          'Before consequences: your ally rerolls their Hope and Fear dice (after you offer support).',
        onUse: (table) => {
          table.rolls?.action?.hopeDie?.reroll();
          table.rolls?.action?.fearDie?.reroll();
        },
      }
    ),
  ],
};
