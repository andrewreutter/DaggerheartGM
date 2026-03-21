import { when, isActing } from '../engine/when.js';

export const Greedy = {
  name: "Greedy",
  description: "Spend a handful of gold to gain a +1 bonus to your Proficiency on a damage roll.",
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      {
        description: "Spend a handful of gold for +1 Proficiency on this damage roll.",
        placements: ['intent'],
        isToggle: true,
        temporaryStatMods: { proficiency: 1 },
        onUse(table, chip) {
          if (chip.isOn) {
            table.action?.addNarration('Spent a handful of gold for extra Proficiency.');
          }
        },
      }
    ),
  ],
};
