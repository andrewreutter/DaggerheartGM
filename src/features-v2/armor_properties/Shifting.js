import { when, isTargeted } from '../engine/when.js';

/** Stored on `character.disadvantageSources` when Shifting disadvantage applies (host clears on rest). */
export const SHIFTING_DISADVANTAGE_SOURCE_ID = 'Shifting';

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
          actionRoll.addDisadvantageDie(SHIFTING_DISADVANTAGE_SOURCE_ID);
        } else {
          actionRoll.removeDisadvantageDie(SHIFTING_DISADVANTAGE_SOURCE_ID);
        }
      },
    }),
  ],
};
