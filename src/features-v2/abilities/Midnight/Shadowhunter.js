/**
 * Midnight domain — Shadowhunter (Level 8 ability)
 * SRD: daggerheart-srd/abilities/Shadowhunter.md — Recall Cost 2
 */

import { when, isActing } from '../../engine/when.js';
import { toggleIsOn } from '../../engine/chip-system.js';

function isShroudedInShadow(table) {
  return toggleIsOn(table, Shadowhunter, Shadowhunter.chips[0]);
}

export const Shadowhunter = {
  name: 'Shadowhunter',
  _source: 'ability',
  description:
    "Your prowess is enhanced under the cover of shadow. While you're shrouded in low light or darkness, you gain a +1 bonus to your Evasion and make attack rolls with advantage.",
  passiveStatMods: when(isShroudedInShadow, { evasion: 1 }),
  hooks: {
    onIntent: when(
      isActing,
      isShroudedInShadow,
      (table) => table.action?.type === 'attack',
      (table) => {
        table.rolls?.action?.addAdvantageDie?.('Shadowhunter');
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Shrouded in low light or darkness',
      description:
        'Toggle on while the GM agrees you are in low light or darkness. While on: +1 Evasion and advantage on attack rolls.',
      isToggle: true,
    },
  ],
};
