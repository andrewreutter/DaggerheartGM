import { when, isActing } from '../engine/when.js';

export const Sharpwing = {
  name: "Sharpwing",
  description: "Gain a bonus to your damage rolls equal to your Agility.",
  hooks: {
    onIntent: when(isActing, (table) => {
      const agility = table.me?.traits?.agility ?? 0;
      if (agility !== 0) {
        table.rolls?.damage?.addStatic({ name: 'Sharpwing', value: agility });
      }
    }),
  },
};
