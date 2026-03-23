import { when, youSucceedOnAnAttack } from '../engine/when.js';

export const Scary = {
  name: "Scary",
  description: "On a successful attack, the target must mark a Stress.",
  hooks: {
    onResolve: when(
      youSucceedOnAnAttack,
      (table) => {
        table.action?.target?.markStress(1);
      }
    ),
  },
};
