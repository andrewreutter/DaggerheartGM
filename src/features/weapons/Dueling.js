export default {
  name: 'Dueling',
  description: 'When no other creatures are within Close range of the target, gain advantage on your attack roll.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Dueling', 'When no other creatures are within Close range of the target, gain advantage on your attack roll.', {});
  },
};
