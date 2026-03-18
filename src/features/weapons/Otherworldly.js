export default {
  name: 'Otherworldly',
  description: 'On a successful attack, you can deal physical or magic damage.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Otherworldly', 'On a successful attack, you can deal physical or magic damage.', {});
  },
};
