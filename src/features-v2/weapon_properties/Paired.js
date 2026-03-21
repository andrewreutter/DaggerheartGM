import { when, isActing } from '../engine/when.js';

export const Paired = {
  name: "Paired",
  description: "+2 to primary weapon damage to targets within Melee range",
  hooks: {
    onIntent: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.action?.range === 'melee',
      (table) => {
        table.rolls?.damage?.addStatic({ name: 'Paired', value: 2 });
      }
    ),
  },
};
