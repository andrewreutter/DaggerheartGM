import { when, isActing } from '../engine/when.js';

export const Concussive = {
  name: "Concussive",
  description: "On a successful attack, you can spend a Hope to knock the target back to Far range.",
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      {
        description: "Spend 1 Hope to knock the target back to Far range.",
        placements: ['reviewAction'],
        hopeCost: 1,
        onUse(table) {
          table.action?.target?.move(
            (t) => t.action.target?.rangeFrom(t.action.attacker) === 'far',
            "Knock target back to Far range"
          );
        }
      }
    )
  ]
};
