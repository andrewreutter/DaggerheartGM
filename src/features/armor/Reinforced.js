/**
 * SRD: When you mark your last Armor Slot, increase your damage thresholds by +2 until you clear at least 1 Armor Slot.
 */
export default {
  name: 'Reinforced',
  description: 'When all Armor Slots are marked, gain +2 to all damage thresholds until armor is restored.',
  onAfterMarkArmor({ character }) {
    if (character.currentArmor >= character.maxArmor) {
      character.setFlag('reinforcedActive', true);
    }
  },
};
