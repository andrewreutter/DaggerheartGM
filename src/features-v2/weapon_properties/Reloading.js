import { when, isActing } from '../engine/when.js';

export const Reloading = {
  name: "Reloading",
  description: "After you make an attack, roll a d6. On a result of 1, you must mark a Stress to reload this weapon before you can fire it again.",
  hooks: {
    onResolve: when(isActing, (table) => table.action?.type === 'attack', (table) => {
      const roll = table.rollDie('d6');
      if (roll === 1) {
        table.me.markStress(1);
      }
    }),
  },
};
