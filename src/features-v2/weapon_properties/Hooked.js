import { when, isActing } from '../engine/when.js';

export const Hooked = {
  name: "Hooked",
  description: "On a successful attack, you can pull the target into Melee range.",
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      {
        description: "Pull the target into Melee range.",
        placements: ['reviewAction'],
        onUse(table) {
          table.action?.target?.move(
            (t) => t.action.target?.rangeFrom(t.action.attacker) === 'melee',
            'Pull target into Melee range'
          );
        },
      }
    ),
  ],
};
