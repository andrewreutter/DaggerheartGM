import { when, isActing } from '../engine/when.js';

export const Quiet = {
  name: "Quiet",
  description: "You gain a +2 bonus to rolls you make to move silently.",
  /** Character sheet / recomputeCharacter (armor roll modifier chips) */
  passiveStatMods: {
    rollModifiers: [{ trait: 'stealth', bonus: 2, label: 'Quiet' }],
  },
  chips: [
    when(isActing, {
      description: "Apply +2 bonus (rolling to move silently).",
      placements: ['intent'],
      isToggle: true,
      onUse: (table) => {
        table.rolls?.action?.addStatic({ name: 'Quiet', value: 2 });
      },
    }),
  ],
};
