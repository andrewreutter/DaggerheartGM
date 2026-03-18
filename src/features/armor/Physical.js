export default {
  name: 'Physical',
  description: 'Armor Slots can only be used against physical damage.',
  onCharacterBuild({ character, armor }) {
    character.addFeature('Physical', 'Armor Slots can only be used against physical damage.', {
      allowsArmorFor: 'phy',
    });
  },
};
