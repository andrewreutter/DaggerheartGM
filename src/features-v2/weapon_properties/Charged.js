import { when, isActing } from '../engine/when.js';

export const Charged = {
  name: "Charged",
  description: "Mark a Stress to gain a +1 bonus to your Proficiency on a primary weapon attack.",
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      {
        description: "Mark a Stress to gain +1 Proficiency on this attack.",
        placements: ['intent'],
        stressCost: 1,
        isToggle: true,
        temporaryStatMods: { proficiency: 1 },
      }
    ),
  ],
};
