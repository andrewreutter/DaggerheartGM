export default {
  name: 'Reinforced',
  description: 'When all Armor Slots are marked, gain +2 to all damage thresholds until armor is restored.',
  /** Activate the +2 threshold bonus when the last armor slot is marked. */
  onArmorSlotMarked({ target }) {
    if (target.currentArmor >= target.maxArmor) {
      target.setFlag('reinforcedActive', true);
    }
  },
};
