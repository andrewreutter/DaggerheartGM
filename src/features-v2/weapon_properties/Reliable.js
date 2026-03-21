import { when, isActing } from '../engine/when.js';

export const Reliable = {
  name: "Reliable",
  description: "+1 to attack rolls",
  hooks: {
    onIntent: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => {
        table.rolls?.action?.addStatic({ name: 'Reliable', value: 1 });
      }
    ),
  },
};
