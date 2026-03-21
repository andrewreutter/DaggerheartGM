import { when, isActing } from '../engine/when.js';

export const Grappling = {
  name: "Grappling",
  description: "On a successful attack, you can spend a Hope to Restrain the target or pull them into Melee range with you.",
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      {
        name: "Grappling (Restrain)",
        description: "Spend 1 Hope to Restrain the target.",
        placements: ['reviewAction'],
        hopeCost: 1,
        onUse(table) {
          table.action?.target?.addCondition('Restrained');
        },
      }
    ),
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      {
        name: "Grappling (Pull)",
        description: "Spend 1 Hope to pull the target into Melee range.",
        placements: ['reviewAction'],
        hopeCost: 1,
        onUse(table) {
          table.action?.target?.move(
            (t) => t.action.target?.rangeFrom(t.action.attacker) === 'melee',
            "Pull target into Melee range"
          );
        },
      }
    ),
  ],
};
