import { when, isActing } from '../engine/when.js';

export const Painful = {
  name: "Painful",
  description: "Each time you make a successful attack, you must mark a Stress.",
  hooks: {
    onResolve: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => {
        table.me.markStress(1);
      }
    ),
  },
};
