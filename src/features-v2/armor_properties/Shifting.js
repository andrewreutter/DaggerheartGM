import { when, isTargeted } from '../engine/when.js';

export const Shifting = {
  name: 'Shifting',
  description:
    'When you are targeted for an attack, you can mark an Armor Slot to give the attack roll against you disadvantage.',
  chips: [
    when(isTargeted, {
      name: 'Shifting',
      description: 'Mark an Armor Slot to give this attack roll disadvantage.',
      placements: ['reviewAction'],
      armorMark: 1,
      isToggle: true,
      onUse(table, chipState) {
        const actionRoll = table.rolls?.action;
        if (!actionRoll) return;
        if (chipState.isOn) {
          actionRoll.addDisadvantageDie('Shifting');
        } else {
          actionRoll.removeDisadvantageDie('Shifting');
        }
      },
    }),
  ],
};
