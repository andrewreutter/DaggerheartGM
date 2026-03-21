import { when, isActing } from '../engine/when.js';

export const Channeling = {
  name: "Channeling",
  description: "+1 to Spellcast Rolls",
  hooks: {
    onIntent: when(
      isActing,
      (table) => table.action?.type === 'spellcast',
      (table) => {
        table.rolls?.action?.addStatic({ name: 'Channeling', value: 1 });
      }
    ),
  },
};
