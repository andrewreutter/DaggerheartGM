import { when, isActing } from '../engine/when.js';

export const Scary = {
  name: "Scary",
  description: "On a successful attack, the target must mark a Stress.",
  hooks: {
    onResolve: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => {
        table.action?.target?.markStress(1);
      }
    ),
  },
};
