import { when, isActing } from '../engine/when.js';

/** Successful weapon attack — shared by Restrain vs Pull chips (Kick-style). */
function grapplingAttackSuccess(table) {
  return table.action?.type === 'attack' && table.rolls?.action?.isSuccess === true;
}

export const Grappling = {
  name: 'Grappling',
  description:
    'On a successful attack, you can spend a Hope to Restrain the target or pull them into Melee range with you.',
  chips: [
    when(
      isActing,
      grapplingAttackSuccess,
      {
        name: 'Grappling (Restrain)',
        description: 'Spend 1 Hope to Restrain the target.',
        placements: ['reviewAction'],
        hopeCost: 1,
        onUse(table) {
          table.action?.target?.addCondition('Restrained');
        },
      }
    ),
    when(
      isActing,
      grapplingAttackSuccess,
      {
        name: 'Grappling (Pull into Melee)',
        description: 'Spend 1 Hope to pull the target into Melee range with you.',
        placements: ['reviewAction'],
        hopeCost: 1,
        onUse(table) {
          table.action?.target?.move(
            (t) => t.action.target?.rangeFrom(t.action.attacker) === 'melee',
            'Pull into Melee range'
          );
        },
      }
    ),
  ],
};
