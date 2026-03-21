import { when, isActing } from '../engine/when.js';

export const Quick = {
  name: 'Quick',
  description:
    'When you make an attack, you can mark a Stress to target another creature within range.',
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      {
        description: 'Mark a Stress to target another creature within range.',
        placements: ['reviewAction'],
        stressCost: 1,
        isToggle: true,
        onUse(table, chip) {
          if (chip.isOn) {
            table.action?.addNarration(
              'Quick: Choose another creature within range to also deal this damage to.'
            );
          }
        },
      }
    ),
  ],
};
