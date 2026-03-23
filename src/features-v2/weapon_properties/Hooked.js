import { when, youSucceedOnAnAttack } from '../engine/when.js';

export const Hooked = {
  name: 'Hooked',
  description: 'On a successful attack, you can pull the target into Melee range.',
  chips: [
    when(
      youSucceedOnAnAttack,
      {
        description: 'Pull the target into Melee range.',
        placements: ['reviewAction'],
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
