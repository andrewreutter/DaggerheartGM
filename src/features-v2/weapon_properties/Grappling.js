import { when, youSucceedOnAnAttack } from '../engine/when.js';

export const Grappling = {
  name: 'Grappling',
  description:
    'On a successful attack, you can spend a Hope to Restrain the target or pull them into Melee range with you.',
  chips: [
    when(
      youSucceedOnAnAttack,
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
      youSucceedOnAnAttack,
      {
        name: 'Grappling (Pull into Melee)',
        description: 'Spend 1 Hope to pull the target into Melee range with you.',
        placements: ['reviewAction'],
        hopeCost: 1,
        onUse(table) {
          table.action?.target?.move(
            (t) => t.action.target?.rangeFrom(t.action.attacker) === 'melee',
            'In Melee range from attacker',
            'Pull into Melee range.'
          );
        },
      }
    ),
  ],
};
