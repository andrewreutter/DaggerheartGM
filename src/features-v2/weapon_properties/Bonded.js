import { when, isActing } from '../engine/when.js';

export const Bonded = {
  name: 'Bonded',
  description: 'Gain a bonus to your damage rolls equal to your level.',
  hooks: {
    onIntent: when(isActing, (table) => {
      const level = table.me?.level ?? 1;
      if (level !== 0) {
        table.rolls?.damage?.addStatic({ name: 'Bonded', value: level });
      }
    }),
  },
};
