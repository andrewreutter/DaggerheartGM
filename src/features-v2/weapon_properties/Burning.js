import { when, isActing } from '../engine/when.js';

export const Burning = {
  name: "Burning",
  description: "When you roll a 6 on a damage die, the target must mark a Stress.",
  hooks: {
    onResolve: when(isActing, (table) => table.action?.type === 'attack', (table) => {
      const damageDice = table.rolls?.damage?.dice ?? [];
      const sixCount = damageDice.filter((d) => d.value === 6).length;
      if (sixCount > 0) {
        table.action?.target?.markStress(sixCount);
      }
    }),
  },
};
