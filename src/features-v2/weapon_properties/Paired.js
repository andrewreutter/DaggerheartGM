import { when, isActing } from '../engine/when.js';

export const Paired = {
  name: "Paired",
  description: "+X to primary weapon damage to targets within Melee range (X = weapon tier + 1).",
  hooks: {
    onIntent: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.action?.range === 'melee',
      (table) => {
        const tier = table.me?.secondaryWeapon?.tier ?? 1;
        const bonus = tier + 1;
        table.rolls?.damage?.addStatic({ name: 'Paired', value: bonus });
      }
    ),
  },
};
