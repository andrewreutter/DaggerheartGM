export default {
  name: 'Reinforced',
  description: 'When all Armor Slots are marked, gain +2 to all damage thresholds until armor is restored.',
  onAfterMarkArmor({ character }) {
    if (character.currentArmor >= character.maxArmor) {
      character.setFlag('reinforcedActive', true);
    }
  },
};
