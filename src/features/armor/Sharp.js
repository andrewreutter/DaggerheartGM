export default {
  name: 'Sharp',
  description: 'When a creature in Melee range hits you with an attack, they take 1d4 damage.',
  onCharacterBuild({ character, armor }) {
    character.addFeature('Sharp', 'When a creature in Melee range hits you with an attack, they take 1d4 damage.', {});
  },
};
