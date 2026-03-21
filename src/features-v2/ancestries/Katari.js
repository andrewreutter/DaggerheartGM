/**
 * Katari Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Katari.md
 */

import { when, isActing } from '../engine/when.js';

export const FelineInstincts = {
  name: 'Feline Instincts',
  description: 'When you make an Agility Roll, you can spend 2 Hope to reroll your Hope Die.',
  chips: [
    when(
      isActing,
      (table) => table.action?.trait === 'Agility' && table.rolls?.action?.hopeDie,
      {
        description: 'Spend 2 Hope to reroll your Hope Die.',
        placements: ['reviewOutcome'],
        hopeCost: 2,
        onUse: (table) => {
          table.rolls?.action?.hopeDie?.reroll();
        },
      }
    ),
  ],
};

export const RetractingClaws = {
  name: 'Retracting Claws',
  description: 'Make an Agility Roll to scratch a target within Melee range. On a success, they become temporarily Vulnerable.',
  virtualWeapons: [
    {
      name: 'Retracting Claws',
      trait: 'agility',
      range: 'melee',
      damage: 'd6',
      description: 'Your natural claws.',
      hooks: {
        onResolve: when(
          isActing,
          (table) => table.rolls?.action?.isSuccess === true && table.action?.target,
          (table) => {
            table.action.target.addCondition('Vulnerable');
          }
        ),
      },
    },
  ],
};
