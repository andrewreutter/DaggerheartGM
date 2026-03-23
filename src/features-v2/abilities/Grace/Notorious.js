/**
 * Grace domain — Notorious (Level 10)
 * SRD: When you leverage your notoriety to get what you want, you can mark a Stress before you roll to gain a +10 bonus to the result.
 * (Food/drinks pricing and loadout rules are narrative / table tracking — not automated here.)
 */

import { when, isActing } from '../../engine/when.js';

export const Notorious = {
  name: 'Notorious',
  description:
    'People know who you are and what you\'ve done, and they treat you differently because of it. When you leverage your notoriety to get what you want, you can **mark a Stress** before you roll to gain a **+10 bonus** to the result. Your food and drinks are always free wherever you go, and everything else you buy is reduced in price by one bag of gold (to a minimum of one handful).\n\nThis card doesn\'t count against your loadout\'s domain card maximum of 5 and can\'t be placed in your vault.',
  chips: [
    when(isActing, {
      name: 'Leverage notoriety',
      description:
        'Mark a Stress before you roll to gain +10 to the result when you leverage your notoriety to get what you want.',
      placements: ['intent'],
      stressCost: 1,
      onUse(table) {
        table.rolls?.action?.addStatic?.({ name: 'Notorious', value: 10 });
      },
    }),
  ],
};
