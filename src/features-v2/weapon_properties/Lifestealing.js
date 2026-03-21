import { when, isActing } from '../engine/when.js';

export const Lifestealing = {
  name: "Lifestealing",
  description: "On a successful attack, roll a d6. On a result of 6, clear a Hit Point.",
  hooks: {
    onResolve: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => {
        const roll = table.rollDie('d6');
        if (roll === 6) {
          table.me.clearHP(1);
        }
      }
    ),
  },
};
