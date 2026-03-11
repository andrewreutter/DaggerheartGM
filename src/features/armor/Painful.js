export default {
  name: 'Painful',
  description: 'When you mark an Armor Slot, you must also mark a Stress.',
  /** Mark 1 Stress on the wearer when an armor slot is marked. */
  onArmorSlotMarked({ target }) {
    target.markStress();
  },
};
