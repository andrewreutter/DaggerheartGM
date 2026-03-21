/**
 * Orc Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Orc.md
 */

import { when, isTargeted } from '../engine/when.js';

export const Sturdy = {
  name: 'Sturdy',
  description:
    'When you have 1 Hit Point remaining, attacks against you have disadvantage.',
  hooks: {
    onIntent: when(
      isTargeted,
      (table) => {
        // Only applies when I have exactly 1 HP remaining
        return table.me?.currentHP === 1;
      },
      (table) => {
        // Add disadvantage by subtracting a d6 from the attack roll
        // This approximates disadvantage (roll twice, take lower)
        table.rolls?.action?.addDie({ name: 'Sturdy (disadvantage)', die: 'd6', value: -1 });
      }
    ),
  },
};

export const Tusks = {
  name: 'Tusks',
  description:
    'When you succeed on an attack against a target within Melee range, you can spend a Hope to gore the target with your tusks, dealing an extra 1d6 damage.',
  chips: [
    when(
      (table) => table.me?.isActing === true,
      (table) => {
        // Only available on successful melee attacks
        return (
          table.action?.type === 'attack' &&
          table.action?.range === 'melee' &&
          table.rolls?.action?.isSuccess === true &&
          table.action?.targets?.length > 0
        );
      },
      {
        description: 'Spend 1 Hope to deal an extra 1d6 damage.',
        placements: ['reviewOutcome'],
        hopeCost: 1,
        onUse(table) {
          table.rolls?.damage?.addDie({ name: 'Tusks', die: 'd6' });
        },
      }
    ),
  ],
};
