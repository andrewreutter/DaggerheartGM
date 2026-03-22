/**
 * SRD: When you are targeted for an attack, you can mark an Armor Slot to give the attack roll against you disadvantage.
 */
const SHIFTING_SOURCE = 'Shifting';

export default {
  name: 'Shifting',
  description: 'When you mark an Armor Slot, attacks against you have disadvantage until you take a rest.',
  onAfterMarkArmor({ character }) {
    if (character?.addDisadvantage) character.addDisadvantage(SHIFTING_SOURCE);
  },
};
