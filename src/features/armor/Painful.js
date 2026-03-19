export default {
  name: 'Painful',
  description: 'When you mark an Armor Slot, you must also mark a Stress.',
  onAfterMarkArmor({ character }) {
    character.markStress();
  },
};
