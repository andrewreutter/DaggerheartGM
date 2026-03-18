export default {
  name: 'Magic',
  description: 'Armor Slots can only be used against magic damage.',
  onCharacterBuild({ character, armor }) {
    character.addFeature('Magic', 'Armor Slots can only be used against magic damage.', {
      allowsArmorFor: 'mag',
    });
  },
};
