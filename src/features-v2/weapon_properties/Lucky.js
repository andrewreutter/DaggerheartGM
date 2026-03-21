import { when, isActing } from '../engine/when.js';

export const Lucky = {
  name: "Lucky",
  description: "On a failed attack, you can mark a Stress to reroll your attack.",
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === false,
      {
        description: "Mark a Stress to reroll your attack.",
        placements: ['reviewAction'],
        stressCost: 1,
        onUse(table) {
          table.rolls?.action?.hopeDie?.reroll();
          table.rolls?.action?.fearDie?.reroll();
        },
      }
    ),
  ],
};
