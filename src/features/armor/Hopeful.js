export default {
  name: 'Hopeful',
  description: 'When you would spend Hope, you can mark an Armor Slot instead.',
  onCharacterBuild({ character, armor }) {
    character.addFeature('Hopeful', 'When you would spend Hope, you can mark an Armor Slot instead.', {});
  },
};
