import { when, youSucceedOnAnAttack } from '../engine/when.js';

export const Painful = {
  name: "Painful",
  description: "Each time you make a successful attack, you must mark a Stress.",
  hooks: {
    onResolve: when(
      youSucceedOnAnAttack,
      (table) => {
        table.me.markStress(1);
      }
    ),
  },
};
