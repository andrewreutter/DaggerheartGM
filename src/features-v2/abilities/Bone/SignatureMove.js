/**
 * Bone domain — Signature Move (Tier 1 / level 5 card)
 * SRD: Once per rest, when you perform your signature move as part of an action, roll a d20 as your Hope Die.
 * On a success, clear a Stress.
 */

import { when, isActing } from '../../engine/when.js';

export const SignatureMove = {
  name: 'Signature Move',
  description:
    "Name and describe your signature combat move. Once per rest, when you perform this signature move as part of an action you're taking, you can roll a **d20** as your Hope Die. On a success, clear a Stress.",
  chips: [
    when(isActing, {
      name: 'Signature Move',
      description: 'Roll a d20 as your Hope Die for this action. On a success, clear a Stress.',
      placements: ['intent'],
      frequency: 'rest',
      onUse(table) {
        table.rolls.action.hopeDie.setDie('d20');
        table.feature.set('signatureMovePending', true);
      },
    }),
  ],
  hooks: {
    onResolve: when(
      isActing,
      (table) => table.feature.get('signatureMovePending') === true,
      (table) => {
        if (table.rolls?.action?.isSuccess) {
          table.me.clearStress(1);
        }
        table.feature.set('signatureMovePending', false);
      }
    ),
  },
};
