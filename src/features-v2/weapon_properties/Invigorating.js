import { when, isActing } from '../engine/when.js';

export const Invigorating = {
  name: "Invigorating",
  description: "On a successful attack, roll a d4. On a result of 4, clear a Stress.",
  hooks: {
    onResolve: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => {
        const roll = table.rollDie('d4');
        if (roll === 4) {
          table.me.clearStress(1);
        }
      }
    ),
  },
};
