import { when, isTargeted } from '../engine/when.js';

export const Deflecting = {
  name: 'Deflecting',
  description:
    'When you are attacked, you can mark an Armor Slot to gain a bonus to your Evasion equal to your available Armor Score against the attack.',
  chips: [
    when(isTargeted, {
      description: 'Mark an Armor Slot to gain +Evasion equal to your available armor slots.',
      placements: ['reviewAction'],
      armorCost: 1,
      isToggle: true,
      temporaryStatMods: {
        evasion: (table) => table.me?.armor ?? 0,
      },
    }),
  ],
};
