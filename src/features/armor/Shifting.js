const SHIFTING_SOURCE = 'Shifting';

export default {
  name: 'Shifting',
  description: 'When you mark an Armor Slot, attacks against you have disadvantage until you take a rest.',
  /** On armor slot marked: add disadvantage until rest (cleared in rest cycle). */
  onArmorSlotMarked({ target }) {
    if (target?.addDisadvantage) target.addDisadvantage(SHIFTING_SOURCE);
  },
};
