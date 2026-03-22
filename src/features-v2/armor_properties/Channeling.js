import { when, isActing } from '../engine/when.js';

export const Channeling = {
  name: "Channeling",
  description: "+1 to Spellcast Rolls",
  /** Character sheet / recomputeCharacter (armor roll modifier chips) */
  passiveStatMods: {
    rollModifiers: [{ trait: 'spellcast', bonus: 1, label: 'Channeling' }],
  },
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
