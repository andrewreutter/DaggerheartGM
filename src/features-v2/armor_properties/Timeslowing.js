import { when, isTargeted } from '../engine/when.js';

export const Timeslowing = {
  name: 'Timeslowing',
  description:
    'Mark an Armor Slot to roll a d4 and add its result as a bonus to your Evasion against an incoming attack.',
  chips: [
    when(
      isTargeted,
      (table) => table.action?.type === 'attack',
      {
        name: 'Timeslowing',
        description: 'Mark an Armor Slot; roll d4 and add it to Evasion vs this attack.',
        placements: ['reviewAction'],
        armorMark: 1,
        isToggle: true,
        temporaryStatMods: {
          evasion: (table) => table.rollDie('d4'),
        },
      }
    ),
  ],
};
