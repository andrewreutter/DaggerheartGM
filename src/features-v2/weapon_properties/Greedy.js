import { when, isActing } from '../engine/when.js';

export const Greedy = {
  name: "Greedy",
  description: "Spend a handful of gold to gain a +1 bonus to your Proficiency on a damage roll.",
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      {
        description: "Spend a handful of gold to gain +1 Proficiency on this damage roll.",
        placements: ['intent'],
        isToggle: true,
        temporaryStatMods: { proficiency: 1 },
      }
    ),
  ],
};
