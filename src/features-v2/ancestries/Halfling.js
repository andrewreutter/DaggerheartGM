/**
 * Halfling Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Halfling.md
 */

import { when, isActing } from '../engine/when.js';

export const Luckbringer = {
  name: 'Luckbringer',
  /** Run once per session for the party (GMTableView session-start), not once per Halfling. */
  sessionStartOnce: true,
  description: 'At the start of each session, everyone in your party gains a Hope.',
  hooks: {
    onSessionStart(table) {
      // Grant 1 Hope to all party members (characters)
      for (const character of table.characters) {
        character.gainHope(1);
      }
    },
  },
};

export const InternalCompass = {
  name: 'Internal Compass',
  description: 'When you roll a 1 on your Hope Die, you can reroll it.',
  chips: [
    when(
      isActing,
      (table) => table.rolls?.action?.hopeDie?.value === 1, // Available when Hope Die value is 1
      {
        description: 'Reroll your Hope Die (rolled a 1).',
        placements: ['reviewAction'],
        onUse(table) {
          table.rolls?.action?.hopeDie?.reroll();
        },
      }
    ),
  ],
};
