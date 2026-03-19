const SHIFTING_SOURCE = 'Shifting';

export default {
  name: 'Shifting',
  description: 'When you mark an Armor Slot, attacks against you have disadvantage until you take a rest.',
  onAfterMarkArmor({ character }) {
    if (character?.addDisadvantage) character.addDisadvantage(SHIFTING_SOURCE);
  },
};
